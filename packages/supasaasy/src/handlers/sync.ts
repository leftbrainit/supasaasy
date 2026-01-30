/**
 * Sync Handler Factory
 *
 * Creates a Deno.serve handler for performing full and incremental synchronization.
 * URL pattern: POST /sync
 * Body: { app_key: string, mode?: 'full' | 'incremental', resource_types?: string[] }
 */

import type { AppConfig, SupaSaaSyConfig, SyncOptions, SyncResult } from '../types/index.ts';
import { createJobTasks, createSyncJob, getSyncState, updateSyncState } from '../db/index.ts';
import {
  type Connector,
  getAppConfig,
  getConnector,
  type IncrementalConnector,
  setConfig,
  supportsIncrementalSync,
} from '../connectors/index.ts';

// Import connectors to ensure they register themselves
import '../connectors/stripe/index.ts';
import '../connectors/intercom/index.ts';
import '../connectors/notion/index.ts';

// =============================================================================
// Types
// =============================================================================

type SyncMode = 'full' | 'incremental';

interface SyncRequest {
  app_key: string;
  mode?: SyncMode;
  resource_types?: string[];
  /** If true, run sync immediately instead of creating a job (for small datasets) */
  immediate?: boolean;
}

interface CollectionSyncResult {
  collection_key: string;
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  error_messages: string[];
}

interface SyncResponse {
  success: boolean;
  app_key: string;
  mode: SyncMode;
  collections: CollectionSyncResult[];
  total_created: number;
  total_updated: number;
  total_deleted: number;
  total_errors: number;
  duration_ms: number;
}

interface JobSyncResponse {
  success: boolean;
  job_id: string;
  app_key: string;
  mode: SyncMode;
  status: string;
  total_tasks: number;
  resource_types: string[];
}

// =============================================================================
// Response Helpers
// =============================================================================

// CORS headers for preflight responses only
// Sync is server-to-server and doesn't require browser CORS
const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Minimal headers for regular responses (no CORS for server-to-server)
const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};

function jsonResponse(
  data: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function errorResponse(message: string, status: number): Response {
  console.error(`Sync error [${status}]: ${message}`);
  return jsonResponse({ error: message, success: false }, status);
}

function successResponse(data: SyncResponse): Response {
  return jsonResponse(data as unknown as Record<string, unknown>, 200);
}

function rateLimitResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests', success: false }), {
    status: 429,
    headers: {
      ...RESPONSE_HEADERS,
      'Retry-After': String(retryAfter),
    },
  });
}

// =============================================================================
// Rate Limiting
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter.
 * For production, consider using a distributed store like Redis.
 */
function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

/**
 * Get rate limit key from API key (first 8 chars for privacy).
 */
function getRateLimitKey(request: Request): string {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const [, token] = authHeader.split(' ');
    if (token) {
      // Use first 8 chars of token as key for privacy
      return `sync:${token.substring(0, 8)}`;
    }
  }
  // Fall back to IP-based limiting
  const forwardedFor = request.headers.get('X-Forwarded-For');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `sync:${ip}`;
}

// =============================================================================
// Security Helpers
// =============================================================================

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate app_key format.
 * Only allows alphanumeric characters, underscores, and hyphens.
 */
function isValidAppKey(appKey: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(appKey) && appKey.length > 0 && appKey.length <= 64;
}

/** Maximum allowed request body size (1MB) */
const MAX_REQUEST_SIZE = 1024 * 1024;

// =============================================================================
// Authentication
// =============================================================================

/**
 * Verify the admin API key from the Authorization header.
 * Expected format: "Bearer <admin_api_key>"
 * Uses constant-time comparison to prevent timing attacks.
 */
function verifyAdminApiKey(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return false;
  }

  const adminApiKey = Deno.env.get('ADMIN_API_KEY');
  if (!adminApiKey) {
    console.error('ADMIN_API_KEY environment variable is not set');
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(token, adminApiKey);
}

// =============================================================================
// Sync Operations
// =============================================================================

/**
 * Perform sync for a single collection using the connector.
 * The connector is responsible for fetching entities from the API,
 * normalizing them, and upserting to the database.
 */
async function syncCollection(
  connector: Connector,
  appConfig: AppConfig,
  collectionKey: string,
  resourceType: string,
  mode: SyncMode,
  sinceDatetime?: Date,
): Promise<CollectionSyncResult> {
  const result: CollectionSyncResult = {
    collection_key: collectionKey,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    error_messages: [],
  };

  const syncStartTime = new Date();

  try {
    let syncResult: SyncResult;
    const syncOptions: SyncOptions = {
      resourceTypes: [resourceType],
    };

    if (mode === 'incremental' && sinceDatetime && supportsIncrementalSync(connector)) {
      // Incremental sync
      console.log(
        `Running incremental sync for ${collectionKey} since ${sinceDatetime.toISOString()}`,
      );
      syncResult = await (connector as IncrementalConnector).incrementalSync(
        appConfig,
        sinceDatetime,
        syncOptions,
      );
    } else {
      // Full sync
      console.log(`Running full sync for ${collectionKey}`);
      syncResult = await connector.fullSync(appConfig, syncOptions);
    }

    // Process sync results from the connector
    // The connector is responsible for fetching, normalizing, and upserting entities
    // It also handles deletion detection during full sync
    result.created = syncResult.created;
    result.updated = syncResult.updated;
    result.deleted = syncResult.deleted;
    result.errors = syncResult.errors;
    if (syncResult.errorMessages) {
      result.error_messages.push(...syncResult.errorMessages);
    }

    // Update sync state on success (only if no fatal errors)
    if (syncResult.success) {
      const { error: stateError } = await updateSyncState(
        appConfig.app_key,
        collectionKey,
        syncStartTime,
        { mode, lastCursor: syncResult.nextCursor },
      );

      if (stateError) {
        console.error(`Failed to update sync state: ${stateError.message}`);
        result.error_messages.push(`Sync state update failed: ${stateError.message}`);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Sync error for ${collectionKey}: ${errorMessage}`);
    result.errors++;
    result.error_messages.push(errorMessage);
  }

  return result;
}

/**
 * Perform sync for all collections of an app.
 */
async function syncApp(
  appConfig: AppConfig,
  mode: SyncMode,
  _config: SupaSaaSyConfig,
  resourceTypes?: string[],
): Promise<Omit<SyncResponse, 'duration_ms'>> {
  const connector = await getConnector(appConfig.connector);
  if (!connector) {
    throw new Error(`Connector not found: ${appConfig.connector}`);
  }

  const collections: CollectionSyncResult[] = [];
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  let totalErrors = 0;

  // Get supported resources from connector metadata
  const supportedResources = connector.metadata.supportedResources;

  // Filter to requested resource types if specified
  const resourcesToSync = resourceTypes
    ? supportedResources.filter((r) => resourceTypes.includes(r.resourceType))
    : supportedResources;

  for (const resource of resourcesToSync) {
    // Determine if we should do incremental sync
    let sinceDatetime: Date | undefined;
    let actualMode = mode;

    if (mode === 'incremental') {
      // Check if connector and resource support incremental sync
      if (!resource.supportsIncrementalSync || !supportsIncrementalSync(connector)) {
        console.log(
          `Resource ${resource.resourceType} does not support incremental sync, using full`,
        );
        actualMode = 'full';
      } else {
        // Get last sync timestamp
        const { data: syncState } = await getSyncState(
          appConfig.app_key,
          resource.collectionKey,
        );

        if (syncState) {
          sinceDatetime = new Date(syncState.last_synced_at);
          console.log(
            `Found sync state for ${resource.collectionKey}: ${sinceDatetime.toISOString()}`,
          );
        } else {
          console.log(`No sync state for ${resource.collectionKey}, falling back to full sync`);
          actualMode = 'full';
        }
      }
    }

    const result = await syncCollection(
      connector,
      appConfig,
      resource.collectionKey,
      resource.resourceType,
      actualMode,
      sinceDatetime,
    );

    collections.push(result);
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalDeleted += result.deleted;
    totalErrors += result.errors;
  }

  return {
    success: totalErrors === 0,
    app_key: appConfig.app_key,
    mode,
    collections,
    total_created: totalCreated,
    total_updated: totalUpdated,
    total_deleted: totalDeleted,
    total_errors: totalErrors,
  };
}

// =============================================================================
// Job-Based Sync Operations
// =============================================================================

/**
 * Create a sync job with tasks.
 * Each task represents one resource type to sync.
 * Workers poll the database for pending tasks and process them completely.
 * Returns the job ID and task information.
 */
async function createSyncJobWithTasks(
  appConfig: AppConfig,
  mode: SyncMode,
  _config: SupaSaaSyConfig,
  resourceTypes: string[] | undefined,
): Promise<JobSyncResponse> {
  const connector = await getConnector(appConfig.connector);
  if (!connector) {
    throw new Error(`Connector not found: ${appConfig.connector}`);
  }

  // Get supported resources from connector metadata
  const supportedResources = connector.metadata.supportedResources;

  // Filter to requested resource types if specified, excluding nested resources
  // (nested resources have syncedWithParent set and are synced as part of their parent)
  const resourcesToSync = resourceTypes
    ? supportedResources.filter((r) =>
      resourceTypes.includes(r.resourceType) && !r.syncedWithParent
    )
    : supportedResources.filter((r) => !r.syncedWithParent);

  if (resourcesToSync.length === 0) {
    throw new Error('No resources to sync');
  }

  const resourceTypesToSync = resourcesToSync.map((r) => r.resourceType);

  // Create the sync job
  const { data: job, error: jobError } = await createSyncJob({
    app_key: appConfig.app_key,
    mode,
    resource_types: resourceTypesToSync,
  });

  if (jobError || !job) {
    throw new Error(`Failed to create sync job: ${jobError?.message || 'Unknown error'}`);
  }

  console.log(`Created sync job ${job.id} for app ${appConfig.app_key}`);

  // Create one task per resource type
  const { error: tasksError } = await createJobTasks(job.id, resourceTypesToSync);

  if (tasksError) {
    throw new Error(`Failed to create job tasks: ${tasksError.message}`);
  }

  console.log(
    `Created ${resourceTypesToSync.length} tasks for job ${job.id}: ${
      resourceTypesToSync.join(', ')
    }`,
  );

  // Job starts as 'pending' - workers will update to 'processing' when they start
  // Note: Workers poll the database for pending tasks and process them automatically

  return {
    success: true,
    job_id: job.id,
    app_key: appConfig.app_key,
    mode,
    status: 'pending',
    total_tasks: resourceTypesToSync.length,
    resource_types: resourceTypesToSync,
  };
}

// =============================================================================
// Handler Factory
// =============================================================================

/**
 * Create a sync handler for the given configuration.
 *
 * @param config The SupaSaaSy configuration
 * @returns A Deno.serve compatible handler function
 *
 * @example
 * ```typescript
 * import { createSyncHandler } from 'supasaasy';
 * import config from '../supasaasy.config.ts';
 *
 * Deno.serve(createSyncHandler(config));
 * ```
 */
export function createSyncHandler(
  config: SupaSaaSyConfig,
): (req: Request) => Promise<Response> {
  // Set the global config for connector lookups
  setConfig(config);

  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_PREFLIGHT_HEADERS,
      });
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    // Rate limiting: 10 requests per minute per API key
    const rateLimitKey = getRateLimitKey(req);
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfter);
    }

    const startTime = Date.now();

    try {
      // Verify admin API key
      if (!verifyAdminApiKey(req)) {
        return errorResponse('Unauthorized: invalid or missing API key', 401);
      }

      // Parse request body
      // Check request body size
      const contentLength = req.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
        return errorResponse('Request body too large', 413);
      }

      let requestBody: SyncRequest;
      try {
        const bodyText = await req.text();
        if (bodyText.length > MAX_REQUEST_SIZE) {
          return errorResponse('Request body too large', 413);
        }
        requestBody = JSON.parse(bodyText);
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      // Validate required fields
      if (!requestBody.app_key) {
        return errorResponse('Missing required field: app_key', 400);
      }

      // Validate app_key format
      if (!isValidAppKey(requestBody.app_key)) {
        return errorResponse('Invalid app_key format', 400);
      }

      const appKey = requestBody.app_key;
      const mode: SyncMode = requestBody.mode || 'incremental';
      const resourceTypes = requestBody.resource_types;
      const immediate = requestBody.immediate || false;

      console.log(`Starting ${mode} sync for app_key: ${appKey} (immediate: ${immediate})`);

      // Look up app configuration
      const appConfig = getAppConfig(appKey, config);
      if (!appConfig) {
        return errorResponse(`Unknown app_key: ${appKey}`, 404);
      }

      // Decide whether to run immediately or create a job
      if (immediate) {
        // Run sync immediately (synchronous, for small datasets)
        console.log(`Running immediate sync for ${appKey}`);
        const result = await syncApp(appConfig, mode, config, resourceTypes);

        const duration = Date.now() - startTime;
        console.log(
          `Sync completed for ${appKey}: created=${result.total_created}, updated=${result.total_updated}, deleted=${result.total_deleted}, errors=${result.total_errors}, duration=${duration}ms`,
        );

        return successResponse({
          ...result,
          duration_ms: duration,
        });
      } else {
        // Create a job with tasks (asynchronous, for large datasets)
        // Workers poll the database for pending tasks and process them
        console.log(`Creating sync job for ${appKey}`);
        const jobResult = await createSyncJobWithTasks(
          appConfig,
          mode,
          config,
          resourceTypes,
        );

        const duration = Date.now() - startTime;
        console.log(
          `Sync job created for ${appKey}: job_id=${jobResult.job_id}, tasks=${jobResult.total_tasks}, duration=${duration}ms`,
        );

        return jsonResponse(
          jobResult as unknown as Record<string, unknown>,
          200,
        );
      }
    } catch (error) {
      // Log detailed error server-side only; return generic message to client
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Unexpected error during sync: ${errorMessage}`);
      return errorResponse('Internal server error', 500);
    }
  };
}
