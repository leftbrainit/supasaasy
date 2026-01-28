/**
 * Webhook Edge Function
 *
 * Receives and processes incoming webhooks from SaaS providers.
 * URL pattern: POST /webhook/{app_key}
 */

import { loadConfig } from '../_shared/config.ts';
import { getAppConfig, getConnector } from '../_shared/connectors/init.ts';
import {
  deleteEntity,
  upsertEntities,
  upsertEntity,
  type UpsertEntityData,
} from '../_shared/db.ts';
import type { AppConfig, NormalizedEntity, ParsedWebhookEvent } from '../_shared/types/index.ts';

// =============================================================================
// Response Helpers
// =============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Signature',
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
  console.error(`Webhook error [${status}]: ${message}`);
  return jsonResponse({ error: message }, status);
}

function successResponse(data?: Record<string, unknown>): Response {
  return jsonResponse({ success: true, ...data }, 200);
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
): Promise<{ action: string; error?: Error }> {
  // For delete events, we don't need entity data
  if (event.eventType === 'delete') {
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      return { action: 'error', error: new Error('Connector not found') };
    }

    // Get collection_key from connector metadata
    const resource = connector.metadata.supportedResources.find(
      (r) => r.resourceType === event.resourceType,
    );
    const collectionKey = resource?.collectionKey ?? event.resourceType;

    const result = await deleteEntity(
      appConfig.app_key,
      collectionKey,
      event.externalId,
    );

    if (result.error) {
      return { action: 'delete', error: result.error };
    }

    return { action: 'delete' };
  }

  // For create, update, archive events, we need entity data
  if (!entity) {
    return { action: 'skip', error: new Error('No entity data extracted') };
  }

  const upsertData = toUpsertData(entity);

  // For archive events, set the archived_at timestamp
  if (event.eventType === 'archive') {
    upsertData.archived_at = event.timestamp.toISOString();
  }

  const result = await upsertEntity(upsertData);

  if (result.error) {
    return { action: event.eventType, error: result.error };
  }

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
): Promise<{ action: string; count: number; error?: Error }> {
  // For delete events, we don't need entity data
  if (event.eventType === 'delete') {
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      return { action: 'error', count: 0, error: new Error('Connector not found') };
    }

    // Get collection_key from connector metadata
    const resource = connector.metadata.supportedResources.find(
      (r) => r.resourceType === event.resourceType,
    );
    const collectionKey = resource?.collectionKey ?? event.resourceType;

    const result = await deleteEntity(
      appConfig.app_key,
      collectionKey,
      event.externalId,
    );

    if (result.error) {
      return { action: 'delete', count: 0, error: result.error };
    }

    return { action: 'delete', count: 1 };
  }

  // For create, update, archive events, we need entity data
  if (entities.length === 0) {
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

  // Batch upsert all entities
  const result = await upsertEntities(upsertDataArray);

  if (result.error) {
    return { action: event.eventType, count: 0, error: result.error };
  }

  return {
    action: event.eventType,
    count: entities.length,
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

  const url = new URL(req.url);

  try {
    // Load configuration first (ensures it's cached for subsequent calls)
    await loadConfig();

    // Extract app_key from URL path
    const appKey = extractAppKey(url);
    if (!appKey) {
      return errorResponse('Invalid webhook URL: missing app_key', 400);
    }

    console.log(`Processing webhook for app_key: ${appKey}`);

    // Look up app configuration
    const appConfig = getAppConfig(appKey);
    if (!appConfig) {
      console.error(`No configuration found for app_key: ${appKey}`);
      return errorResponse('Unknown app_key', 404);
    }

    // Get the connector for this provider
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      console.error(`No connector found for provider: ${appConfig.connector}`);
      return errorResponse('Connector not available', 500);
    }

    // Verify webhook signature BEFORE parsing payload
    // This prevents malicious payload inspection attacks
    const verificationResult = await connector.verifyWebhook(req, appConfig);
    if (!verificationResult.valid) {
      console.error(`Webhook verification failed: ${verificationResult.reason}`);
      return errorResponse(
        verificationResult.reason || 'Webhook verification failed',
        401,
      );
    }

    // Parse the webhook event
    const event = await connector.parseWebhookEvent(
      verificationResult.payload,
      appConfig,
    );

    console.log(
      `Webhook event: ${event.originalEventType} -> ${event.eventType} for ${event.resourceType}:${event.externalId}`,
    );

    // Extract and normalize entity data
    // Use extractEntities if available (for nested resources like subscription items)
    // Otherwise fall back to extractEntity for single entity
    if (connector.extractEntities) {
      const entities = await connector.extractEntities(event, appConfig);

      console.log(`Extracted ${entities.length} entity(ies) from webhook`);

      // Process all entities
      const result = await processWebhookEntities(event, entities, appConfig);

      if (result.error) {
        console.error(`Error processing webhook: ${result.error.message}`);
        return errorResponse(`Processing error: ${result.error.message}`, 500);
      }

      console.log(
        `Webhook processed successfully: ${result.action} ${result.count} entity(ies) for ${event.resourceType}:${event.externalId}`,
      );

      return successResponse({
        action: result.action,
        resourceType: event.resourceType,
        externalId: event.externalId,
        entityCount: result.count,
      });
    }

    // Fallback to single entity extraction for connectors without extractEntities
    const entity = await connector.extractEntity(event, appConfig);

    // Process the event (upsert, delete, or archive)
    const result = await processWebhookEvent(event, entity, appConfig);

    if (result.error) {
      console.error(`Error processing webhook: ${result.error.message}`);
      return errorResponse(`Processing error: ${result.error.message}`, 500);
    }

    console.log(
      `Webhook processed successfully: ${result.action} for ${event.resourceType}:${event.externalId}`,
    );

    return successResponse({
      action: result.action,
      resourceType: event.resourceType,
      externalId: event.externalId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error processing webhook: ${errorMessage}`);
    return errorResponse('Internal server error', 500);
  }
});
