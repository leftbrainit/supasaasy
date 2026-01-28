/**
 * Sync Edge Function
 *
 * Performs full and incremental synchronization of SaaS data.
 * Supports manual triggers via POST requests and scheduled execution via pg_cron.
 *
 * URL pattern: POST /sync
 * Body: { app_key: string, mode?: 'full' | 'incremental', resource_types?: string[] }
 */

import { loadConfig } from '../_shared/config.ts';
import {
  type Connector,
  getAppConfig,
  getConnector,
  type IncrementalConnector,
  supportsIncrementalSync,
} from '../_shared/connectors/init.ts';
import { getSyncState, updateSyncState } from '../_shared/db.ts';
import type { AppConfig, SyncOptions, SyncResult } from '../_shared/types/index.ts';

// =============================================================================
// Types
// =============================================================================

type SyncMode = 'full' | 'incremental';

interface SyncRequest {
  app_key: string;
  mode?: SyncMode;
  resource_types?: string[];
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

// =============================================================================
// Response Helpers
// =============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(
  data: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message: string, status: number): Response {
  console.error(`Sync error [${status}]: ${message}`);
  return jsonResponse({ error: message, success: false }, status);
}

function successResponse(data: SyncResponse): Response {
  return jsonResponse(data as unknown as Record<string, unknown>, 200);
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Verify the admin API key from the Authorization header.
 * Expected format: "Bearer <admin_api_key>"
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

  return token === adminApiKey;
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
// Main Handler
// =============================================================================

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const startTime = Date.now();

  try {
    // Verify admin API key
    if (!verifyAdminApiKey(req)) {
      return errorResponse('Unauthorized: invalid or missing API key', 401);
    }

    // Load configuration
    await loadConfig();

    // Parse request body
    let requestBody: SyncRequest;
    try {
      requestBody = await req.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    // Validate required fields
    if (!requestBody.app_key) {
      return errorResponse('Missing required field: app_key', 400);
    }

    const appKey = requestBody.app_key;
    const mode: SyncMode = requestBody.mode || 'incremental';
    const resourceTypes = requestBody.resource_types;

    console.log(`Starting ${mode} sync for app_key: ${appKey}`);

    // Look up app configuration
    const appConfig = getAppConfig(appKey);
    if (!appConfig) {
      return errorResponse(`Unknown app_key: ${appKey}`, 404);
    }

    // Perform sync
    const result = await syncApp(appConfig, mode, resourceTypes);

    const duration = Date.now() - startTime;
    console.log(
      `Sync completed for ${appKey}: created=${result.total_created}, updated=${result.total_updated}, deleted=${result.total_deleted}, errors=${result.total_errors}, duration=${duration}ms`,
    );

    return successResponse({
      ...result,
      duration_ms: duration,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error during sync: ${errorMessage}`);
    return errorResponse(`Internal server error: ${errorMessage}`, 500);
  }
});
