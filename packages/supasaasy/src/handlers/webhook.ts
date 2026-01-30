/**
 * Webhook Handler Factory
 *
 * Creates a Deno.serve handler for processing incoming webhooks from SaaS providers.
 * URL pattern: POST /webhook/{app_key}
 */

import type {
  AppConfig,
  NormalizedEntity,
  ParsedWebhookEvent,
  SupaSaaSyConfig,
} from '../types/index.ts';
import {
  deleteEntity,
  insertWebhookLog,
  upsertEntities,
  upsertEntity,
  type UpsertEntityData,
  type WebhookLogData,
} from '../db/index.ts';
import { getAppConfig, getConnector, setConfig } from '../connectors/index.ts';
import { debugLog, isDebugEnabled } from '../connectors/utils.ts';

// Import connectors to ensure they register themselves
import '../connectors/stripe/index.ts';
import '../connectors/intercom/index.ts';
import '../connectors/notion/index.ts';

// =============================================================================
// Response Helpers
// =============================================================================

// CORS headers for preflight responses only
// Webhooks are server-to-server and don't require browser CORS
const CORS_PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Signature',
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
  console.error(`Webhook error [${status}]: ${message}`);
  return jsonResponse({ error: message }, status);
}

function successResponse(data?: Record<string, unknown>): Response {
  return jsonResponse({ success: true, ...data }, 200);
}

function rateLimitResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      ...RESPONSE_HEADERS,
      'Retry-After': String(retryAfter),
    },
  });
}

// =============================================================================
// Webhook Logging
// =============================================================================

/**
 * Helper to convert Request headers to a plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/**
 * Log a webhook request to the database (async, non-blocking)
 */
function logWebhook(
  config: SupaSaaSyConfig,
  request: Request,
  appKey: string | undefined,
  responseStatus: number,
  responseBody: Record<string, unknown>,
  errorMessage: string | undefined,
  startTime: number,
  requestBody?: Record<string, unknown>,
): void {
  // Only log if webhook_logging is enabled
  if (!config.webhook_logging?.enabled) {
    return;
  }

  try {
    const url = new URL(request.url);
    const processingDurationMs = Date.now() - startTime;

    const logData: WebhookLogData = {
      app_key: appKey,
      request_method: request.method,
      request_path: url.pathname,
      request_headers: headersToObject(request.headers),
      request_body: requestBody,
      response_status: responseStatus,
      response_body: responseBody,
      error_message: errorMessage,
      processing_duration_ms: processingDurationMs,
    };

    // Insert log entry asynchronously (don't await to avoid blocking response)
    insertWebhookLog(logData).catch((err) => {
      console.error('Failed to log webhook:', err);
    });
  } catch (err) {
    // Don't let logging errors affect webhook processing
    console.error('Error in logWebhook:', err);
  }
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
 * Get client identifier for rate limiting.
 * Uses X-Forwarded-For header or falls back to a default key.
 */
function getRateLimitKey(request: Request, appKey?: string): string {
  const forwardedFor = request.headers.get('X-Forwarded-For');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return appKey ? `webhook:${appKey}:${ip}` : `webhook:${ip}`;
}

// =============================================================================
// Input Validation
// =============================================================================

/**
 * Validate app_key format.
 * Only allows alphanumeric characters, underscores, and hyphens.
 */
function isValidAppKey(appKey: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(appKey) && appKey.length > 0 && appKey.length <= 64;
}

/** Maximum allowed request body size (1MB) */
const MAX_REQUEST_SIZE = 1024 * 1024;

/**
 * Check if request body size is within limits.
 */
function checkRequestSize(request: Request): boolean {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return false;
  }
  return true;
}

// =============================================================================
// URL Path Parsing
// =============================================================================

/**
 * Extract the app_key from the URL path.
 * Expected path: /webhook/{app_key}
 */
function extractAppKey(url: URL): string | null {
  const pathname = url.pathname;

  // Remove leading /webhook/ or /functions/v1/webhook/
  // Edge Functions can be invoked with different path prefixes
  const webhookMatch = pathname.match(/\/webhook\/([^/]+)/);

  if (webhookMatch && webhookMatch[1]) {
    return webhookMatch[1];
  }

  return null;
}

// =============================================================================
// Entity Operations
// =============================================================================

/**
 * Convert a NormalizedEntity to the database upsert format
 */
function toUpsertData(entity: NormalizedEntity): UpsertEntityData {
  return {
    external_id: entity.externalId,
    app_key: entity.appKey,
    collection_key: entity.collectionKey,
    raw_payload: entity.rawPayload,
    api_version: entity.apiVersion,
    archived_at: entity.archivedAt?.toISOString() ?? null,
  };
}

/**
 * Process a webhook event and perform the appropriate entity operation
 * (legacy single-entity version for backwards compatibility)
 */
async function processWebhookEvent(
  event: ParsedWebhookEvent,
  entity: NormalizedEntity | null,
  appConfig: AppConfig,
  _config: SupaSaaSyConfig,
): Promise<{ action: string; error?: Error }> {
  debugLog('webhook', 'Processing webhook event', {
    eventType: event.eventType,
    resourceType: event.resourceType,
    externalId: event.externalId,
    originalEventType: event.originalEventType,
    hasEntity: entity !== null,
  });

  // For delete events, we don't need entity data
  if (event.eventType === 'delete') {
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      debugLog('webhook', 'Connector not found for delete event');
      return { action: 'error', error: new Error('Connector not found') };
    }

    // Get collection_key from connector metadata
    const resource = connector.metadata.supportedResources.find(
      (r) => r.resourceType === event.resourceType,
    );
    const collectionKey = resource?.collectionKey ?? event.resourceType;

    debugLog('webhook', 'Deleting entity', {
      appKey: appConfig.app_key,
      collectionKey,
      externalId: event.externalId,
    });

    const result = await deleteEntity(
      appConfig.app_key,
      collectionKey,
      event.externalId,
    );

    if (result.error) {
      debugLog('webhook', 'Delete failed', { error: result.error.message });
      return { action: 'delete', error: result.error };
    }

    debugLog('webhook', 'Delete succeeded', { count: result.count });
    return { action: 'delete' };
  }

  // For create, update, archive events, we need entity data
  if (!entity) {
    debugLog('webhook', 'No entity data extracted, skipping');
    return { action: 'skip', error: new Error('No entity data extracted') };
  }

  const upsertData = toUpsertData(entity);

  // For archive events, set the archived_at timestamp
  if (event.eventType === 'archive') {
    upsertData.archived_at = event.timestamp.toISOString();
  }

  debugLog('webhook', 'Upserting entity', {
    appKey: upsertData.app_key,
    collectionKey: upsertData.collection_key,
    externalId: upsertData.external_id,
    eventType: event.eventType,
  });

  const result = await upsertEntity(upsertData);

  if (result.error) {
    debugLog('webhook', 'Upsert failed', { error: result.error.message });
    return { action: event.eventType, error: result.error };
  }

  debugLog('webhook', 'Upsert succeeded', { created: result.created });

  return {
    action: event.eventType,
  };
}

/**
 * Process a webhook event with multiple entities (e.g., subscription with items)
 */
async function processWebhookEntities(
  event: ParsedWebhookEvent,
  entities: NormalizedEntity[],
  appConfig: AppConfig,
  _config: SupaSaaSyConfig,
): Promise<{ action: string; count: number; error?: Error }> {
  debugLog('webhook', 'Processing webhook event with multiple entities', {
    eventType: event.eventType,
    resourceType: event.resourceType,
    externalId: event.externalId,
    originalEventType: event.originalEventType,
    entityCount: entities.length,
  });

  // For delete events, we don't need entity data
  if (event.eventType === 'delete') {
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      debugLog('webhook', 'Connector not found for delete event');
      return { action: 'error', count: 0, error: new Error('Connector not found') };
    }

    // Get collection_key from connector metadata
    const resource = connector.metadata.supportedResources.find(
      (r) => r.resourceType === event.resourceType,
    );
    const collectionKey = resource?.collectionKey ?? event.resourceType;

    debugLog('webhook', 'Deleting entity', {
      appKey: appConfig.app_key,
      collectionKey,
      externalId: event.externalId,
    });

    const result = await deleteEntity(
      appConfig.app_key,
      collectionKey,
      event.externalId,
    );

    if (result.error) {
      debugLog('webhook', 'Delete failed', { error: result.error.message });
      return { action: 'delete', count: 0, error: result.error };
    }

    debugLog('webhook', 'Delete succeeded', { count: result.count });
    return { action: 'delete', count: 1 };
  }

  // For create, update, archive events, we need entity data
  if (entities.length === 0) {
    debugLog('webhook', 'No entity data extracted, skipping');
    return { action: 'skip', count: 0, error: new Error('No entity data extracted') };
  }

  // Convert all entities to upsert format
  const upsertDataArray: UpsertEntityData[] = entities.map((entity) => {
    const data = toUpsertData(entity);
    // For archive events, set the archived_at timestamp
    if (event.eventType === 'archive') {
      data.archived_at = event.timestamp.toISOString();
    }
    return data;
  });

  debugLog('webhook', 'Batch upserting entities', {
    count: upsertDataArray.length,
    externalIds: upsertDataArray.map((e) => e.external_id),
    collectionKeys: [...new Set(upsertDataArray.map((e) => e.collection_key))],
  });

  // Batch upsert all entities
  const result = await upsertEntities(upsertDataArray);

  if (result.error) {
    debugLog('webhook', 'Batch upsert failed', { error: result.error.message });
    return { action: event.eventType, count: 0, error: result.error };
  }

  debugLog('webhook', 'Batch upsert succeeded', { count: entities.length });

  return {
    action: event.eventType,
    count: entities.length,
  };
}

// =============================================================================
// Handler Factory
// =============================================================================

/**
 * Create a webhook handler for the given configuration.
 *
 * @param config The SupaSaaSy configuration
 * @returns A Deno.serve compatible handler function
 *
 * @example
 * ```typescript
 * import { createWebhookHandler } from 'supasaasy';
 * import config from '../supasaasy.config.ts';
 *
 * Deno.serve(createWebhookHandler(config));
 * ```
 */
export function createWebhookHandler(
  config: SupaSaaSyConfig,
): (req: Request) => Promise<Response> {
  // Set the global config for connector lookups
  setConfig(config);

  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    const url = new URL(req.url);
    let appKey: string | undefined;
    let requestBody: Record<string, unknown> | undefined;

    debugLog('webhook', 'Webhook request received', {
      method: req.method,
      path: url.pathname,
      debugEnabled: isDebugEnabled(),
    });

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const response = new Response(null, {
        status: 204,
        headers: CORS_PREFLIGHT_HEADERS,
      });
      // Log preflight requests if enabled
      logWebhook(
        config,
        req,
        undefined,
        204,
        {},
        undefined,
        startTime,
      );
      return response;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      const responseBody = { error: 'Method not allowed' };
      logWebhook(
        config,
        req,
        undefined,
        405,
        responseBody,
        'Method not allowed',
        startTime,
      );
      return errorResponse('Method not allowed', 405);
    }

    // Check request body size before processing
    if (!checkRequestSize(req)) {
      const responseBody = { error: 'Request body too large' };
      logWebhook(
        config,
        req,
        undefined,
        413,
        responseBody,
        'Request body too large',
        startTime,
      );
      return errorResponse('Request body too large', 413);
    }

    // Rate limiting: 100 requests per minute per IP
    const rateLimitKey = getRateLimitKey(req);
    const rateLimit = checkRateLimit(rateLimitKey, 100, 60000);
    if (!rateLimit.allowed) {
      const responseBody = { error: 'Too many requests' };
      debugLog('webhook', 'Rate limit exceeded', { rateLimitKey });
      logWebhook(
        config,
        req,
        undefined,
        429,
        responseBody,
        'Rate limit exceeded',
        startTime,
      );
      return rateLimitResponse(rateLimit.retryAfter);
    }

    try {
      // Extract app_key from URL path
      appKey = extractAppKey(url) ?? undefined;
      if (!appKey) {
        debugLog('webhook', 'Missing app_key in URL', { path: url.pathname });
        const responseBody = { error: 'Invalid webhook URL: missing app_key' };
        logWebhook(
          config,
          req,
          undefined,
          400,
          responseBody,
          'Invalid webhook URL: missing app_key',
          startTime,
        );
        return errorResponse('Invalid webhook URL: missing app_key', 400);
      }

      // Validate app_key format
      if (!isValidAppKey(appKey)) {
        debugLog('webhook', 'Invalid app_key format', { appKey });
        const responseBody = { error: 'Invalid app_key format' };
        logWebhook(
          config,
          req,
          appKey,
          400,
          responseBody,
          'Invalid app_key format',
          startTime,
        );
        return errorResponse('Invalid app_key format', 400);
      }

      console.log(`Processing webhook for app_key: ${appKey}`);

      debugLog('webhook', 'Processing webhook', { appKey });

      // Look up app configuration
      const appConfig = getAppConfig(appKey, config);
      if (!appConfig) {
        console.error(`No configuration found for app_key: ${appKey}`);
        debugLog('webhook', 'Unknown app_key', { appKey });
        const responseBody = { error: 'Unknown app_key' };
        logWebhook(
          config,
          req,
          appKey,
          404,
          responseBody,
          'Unknown app_key',
          startTime,
        );
        return errorResponse('Unknown app_key', 404);
      }

      debugLog('webhook', 'App config found', {
        appKey: appConfig.app_key,
        connector: appConfig.connector,
      });

      // Get the connector for this provider
      const connector = await getConnector(appConfig.connector);
      if (!connector) {
        console.error(`No connector found for provider: ${appConfig.connector}`);
        debugLog('webhook', 'Connector not available', { connector: appConfig.connector });
        const responseBody = { error: 'Connector not available' };
        logWebhook(
          config,
          req,
          appKey,
          500,
          responseBody,
          'Connector not available',
          startTime,
        );
        return errorResponse('Connector not available', 500);
      }

      debugLog('webhook', 'Connector retrieved', {
        connectorName: connector.metadata.name,
      });

      // Verify webhook signature BEFORE parsing payload
      // This prevents malicious payload inspection attacks
      debugLog('webhook', 'Verifying webhook signature');
      const verificationResult = await connector.verifyWebhook(req, appConfig);
      if (!verificationResult.valid) {
        console.error(`Webhook verification failed: ${verificationResult.reason}`);
        debugLog('webhook', 'Webhook verification failed', {
          reason: verificationResult.reason,
          // Never log signature or secret values
        });
        const responseBody = { error: verificationResult.reason || 'Webhook verification failed' };
        logWebhook(
          config,
          req,
          appKey,
          401,
          responseBody,
          verificationResult.reason || 'Webhook verification failed',
          startTime,
        );
        return errorResponse(
          verificationResult.reason || 'Webhook verification failed',
          401,
        );
      }

      debugLog('webhook', 'Webhook verification succeeded');

      // Store request body for logging (after verification)
      if (typeof verificationResult.payload === 'object' && verificationResult.payload !== null) {
        requestBody = verificationResult.payload as Record<string, unknown>;
      }

      // Parse the webhook event
      const event = await connector.parseWebhookEvent(
        verificationResult.payload,
        appConfig,
      );

      console.log(
        `Webhook event: ${event.originalEventType} -> ${event.eventType} for ${event.resourceType}:${event.externalId}`,
      );

      debugLog('webhook', 'Webhook event parsed', {
        originalEventType: event.originalEventType,
        eventType: event.eventType,
        resourceType: event.resourceType,
        externalId: event.externalId,
        timestamp: event.timestamp.toISOString(),
      });

      // Extract and normalize entity data
      // Use extractEntities if available (for nested resources like subscription items)
      // Otherwise fall back to extractEntity for single entity
      if (connector.extractEntities) {
        debugLog('webhook', 'Extracting multiple entities');
        const entities = await connector.extractEntities(event, appConfig);

        console.log(`Extracted ${entities.length} entity(ies) from webhook`);

        debugLog('webhook', 'Entities extracted', {
          count: entities.length,
          externalIds: entities.map((e) => e.externalId),
          collectionKeys: [...new Set(entities.map((e) => e.collectionKey))],
        });

        // Process all entities
        const result = await processWebhookEntities(event, entities, appConfig, config);

        if (result.error) {
          // Log detailed error server-side only; return generic message to client
          console.error(`Error processing webhook: ${result.error.message}`);
          debugLog('webhook', 'Webhook processing failed', {
            error: result.error.message,
          });
          const responseBody = { error: 'Internal server error' };
          logWebhook(
            config,
            req,
            appKey,
            500,
            responseBody,
            result.error.message,
            startTime,
            requestBody,
          );
          return errorResponse('Internal server error', 500);
        }

        console.log(
          `Webhook processed successfully: ${result.action} ${result.count} entity(ies) for ${event.resourceType}:${event.externalId}`,
        );

        debugLog('webhook', 'Webhook processed successfully', {
          action: result.action,
          entityCount: result.count,
          resourceType: event.resourceType,
          externalId: event.externalId,
          durationMs: Date.now() - startTime,
        });

        const responseBody = {
          success: true,
          action: result.action,
          resourceType: event.resourceType,
          externalId: event.externalId,
          entityCount: result.count,
        };
        logWebhook(
          config,
          req,
          appKey,
          200,
          responseBody,
          undefined,
          startTime,
          requestBody,
        );

        return successResponse({
          action: result.action,
          resourceType: event.resourceType,
          externalId: event.externalId,
          entityCount: result.count,
        });
      }

      // Fallback to single entity extraction for connectors without extractEntities
      debugLog('webhook', 'Extracting single entity');
      const entity = await connector.extractEntity(event, appConfig);

      debugLog('webhook', 'Entity extracted', {
        hasEntity: entity !== null,
        externalId: entity?.externalId,
        collectionKey: entity?.collectionKey,
      });

      // Process the event (upsert, delete, or archive)
      const result = await processWebhookEvent(event, entity, appConfig, config);

      if (result.error) {
        // Log detailed error server-side only; return generic message to client
        console.error(`Error processing webhook: ${result.error.message}`);
        debugLog('webhook', 'Webhook processing failed', {
          error: result.error.message,
        });
        const responseBody = { error: 'Internal server error' };
        logWebhook(
          config,
          req,
          appKey,
          500,
          responseBody,
          result.error.message,
          startTime,
          requestBody,
        );
        return errorResponse('Internal server error', 500);
      }

      console.log(
        `Webhook processed successfully: ${result.action} for ${event.resourceType}:${event.externalId}`,
      );

      debugLog('webhook', 'Webhook processed successfully', {
        action: result.action,
        resourceType: event.resourceType,
        externalId: event.externalId,
        durationMs: Date.now() - startTime,
      });

      const responseBody = {
        success: true,
        action: result.action,
        resourceType: event.resourceType,
        externalId: event.externalId,
      };
      logWebhook(
        config,
        req,
        appKey,
        200,
        responseBody,
        undefined,
        startTime,
        requestBody,
      );

      return successResponse({
        action: result.action,
        resourceType: event.resourceType,
        externalId: event.externalId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Unexpected error processing webhook: ${errorMessage}`);
      debugLog('webhook', 'Webhook failed with unexpected error', {
        error: errorMessage,
        appKey,
      });
      const responseBody = { error: 'Internal server error' };
      logWebhook(
        config,
        req,
        appKey,
        500,
        responseBody,
        errorMessage,
        startTime,
        requestBody,
      );
      return errorResponse('Internal server error', 500);
    }
  };
}
