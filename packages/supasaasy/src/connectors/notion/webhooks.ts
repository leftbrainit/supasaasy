/**
 * Notion Webhooks Module
 *
 * Handles webhook verification, parsing, and entity extraction.
 * Notion uses HMAC SHA-256 for webhook signature verification with the X-Notion-Signature header.
 */

import type {
  AppConfig,
  NormalizedEntity,
  ParsedWebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../types/index.ts';
import { createNotionClient, getWebhookSecret, logger } from './client.ts';
import {
  extractDataSourceProperties,
  normalizeDataSource,
  normalizeNotionEntity,
  normalizePage,
  normalizeUser,
} from './normalization.ts';
import {
  NOTION_WEBHOOK_EVENTS,
  type NotionDataSource,
  type NotionPage,
  type NotionResourceType,
  type NotionUser,
  type NotionWebhookEventType,
  type NotionWebhookPayload,
} from './types.ts';

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Compute HMAC SHA-256 signature for Notion webhook verification
 */
async function computeHmacSha256(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Constant-time string comparison to prevent timing attacks
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
 * Verify incoming webhook signature using HMAC SHA-256
 * Notion signs webhooks using the integration's webhook secret
 */
export async function verifyWebhook(
  request: Request,
  appConfig: AppConfig,
): Promise<WebhookVerificationResult> {
  try {
    const webhookSecret = getWebhookSecret(appConfig);
    const body = await request.text();

    // Get the signature header
    const signatureHeader = request.headers.get('X-Notion-Signature');
    if (!signatureHeader) {
      return {
        valid: false,
        reason: 'Missing X-Notion-Signature header',
      };
    }

    // Notion sends signature as "sha256=<hex>" - extract just the hex part
    const signature = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    // Compute expected signature
    const expectedSignature = await computeHmacSha256(webhookSecret, body);

    // Compare signatures using constant-time comparison
    if (!constantTimeEqual(signature, expectedSignature)) {
      logger.warn('webhook', 'Webhook signature verification failed');
      return {
        valid: false,
        reason: 'Invalid webhook signature',
      };
    }

    // Parse the payload
    const payload = JSON.parse(body) as NotionWebhookPayload;

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('webhook', `Verification failed: ${message}`);
    return {
      valid: false,
      reason: `Webhook verification failed: ${message}`,
    };
  }
}

// =============================================================================
// Webhook Event Parsing
// =============================================================================

/**
 * Parse a verified webhook event into our normalized format
 */
// deno-lint-ignore require-await
export async function parseWebhookEvent(
  payload: unknown,
  _appConfig: AppConfig,
): Promise<ParsedWebhookEvent> {
  const event = payload as NotionWebhookPayload;
  const eventType = event.type as NotionWebhookEventType;

  const mapping = NOTION_WEBHOOK_EVENTS[eventType];
  if (!mapping) {
    logger.warn('webhook', `Unknown event type: ${eventType}`);
    return {
      eventType: 'update',
      originalEventType: eventType,
      resourceType: 'unknown',
      externalId: '',
      data: (event.data?.object as unknown as Record<string, unknown>) ?? {},
      timestamp: new Date(event.timestamp),
      metadata: {
        workspace_id: event.workspace_id,
        integration_id: event.integration_id,
        event_id: event.event_id,
      },
    };
  }

  // Extract the resource ID - Notion puts this at the top level for most events
  let externalId: string;
  let data: Record<string, unknown>;

  if (mapping.eventType === 'delete') {
    externalId = event.data?.deleted_object?.id ?? '';
    data = (event.data?.deleted_object as unknown as Record<string, unknown>) ?? {};
  } else {
    const eventData = event.data as Record<string, unknown>;

    // For non-delete events, extract the resource ID
    // Notion 2025-09-03 API puts the entity reference at the top level as `entity: { id, type }`
    // Also check legacy fields for backward compatibility
    externalId = event.entity?.id ??
      event.page_id ??
      event.data_source_id ??
      event.user_id ??
      '';

    // For data, try to get the full object if present (create events),
    // otherwise use the partial data (update events)
    const fullObj = eventData?.page ?? eventData?.data_source ?? eventData?.object;
    data = fullObj ? (fullObj as unknown as Record<string, unknown>) : (eventData ?? {});

    // Log if we couldn't find the ID for debugging
    if (!externalId) {
      logger.warn('webhook', 'Could not extract ID from webhook payload', {
        eventType,
        hasEntity: !!event.entity,
        entityId: event.entity?.id,
        dataKeys: eventData ? Object.keys(eventData) : [],
      });
    }
  }

  // Map our internal event types to WebhookEventType
  let webhookEventType: WebhookEventType = 'update';
  if (mapping.eventType === 'create') {
    webhookEventType = 'create';
  } else if (mapping.eventType === 'delete') {
    webhookEventType = 'delete';
  } else if (mapping.eventType === 'undelete') {
    // Treat undelete as an update that clears archived_at
    webhookEventType = 'update';
  }

  return {
    eventType: webhookEventType,
    originalEventType: eventType,
    resourceType: mapping.resourceType,
    externalId,
    data,
    timestamp: new Date(event.timestamp),
    metadata: {
      workspace_id: event.workspace_id,
      integration_id: event.integration_id,
      event_id: event.event_id,
      is_undelete: mapping.eventType === 'undelete',
    },
  };
}

// =============================================================================
// Entity Extraction
// =============================================================================

/**
 * Extract and normalize entity from webhook event
 */
// deno-lint-ignore require-await
export async function extractEntity(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity | null> {
  if (event.resourceType === 'unknown') {
    return null;
  }

  // For delete events, we don't need entity data
  if (event.eventType === 'delete') {
    return null;
  }

  // Use extractEntities and return the first entity (main resource, not properties)
  const entities = await extractEntities(event, appConfig);
  return entities.length > 0 ? entities[0] : null;
}

/**
 * Check if the webhook data contains a full object (has 'id' and 'object' fields)
 * or just partial update data.
 */
function hasFullObjectData(data: Record<string, unknown>): boolean {
  return typeof data.id === 'string' && typeof data.object === 'string';
}

/**
 * Extract and normalize multiple entities from webhook event.
 * Handles data source properties embedded in data source events.
 * For update events with partial data, fetches the full object from the API.
 */
export async function extractEntities(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity[]> {
  const entities: NormalizedEntity[] = [];

  if (event.resourceType === 'unknown' || event.eventType === 'delete') {
    return entities;
  }

  const resourceType = event.resourceType as NotionResourceType;
  const client = createNotionClient(appConfig);

  // Handle data source events - also extract properties
  if (resourceType === 'data_source') {
    let dataSource: NotionDataSource;

    // Check if we have full data or need to fetch
    if (hasFullObjectData(event.data)) {
      dataSource = event.data as unknown as NotionDataSource;
    } else {
      // Fetch the full data source from the API
      logger.info('webhook', `Fetching full data source: ${event.externalId}`);
      dataSource = await client.getDataSource(event.externalId);
    }

    // Add the main data source entity
    const dataSourceEntity = normalizeDataSource(dataSource, appConfig);
    entities.push(dataSourceEntity);

    // Extract and add properties
    const propertyEntities = extractDataSourceProperties(dataSource, appConfig);
    logger.info(
      'webhook',
      `Data source ${dataSource.id} has ${propertyEntities.length} properties`,
    );
    entities.push(...propertyEntities);

    return entities;
  }

  // Handle page events
  if (resourceType === 'page') {
    let page: NotionPage;

    // Check if we have full data or need to fetch
    if (hasFullObjectData(event.data)) {
      page = event.data as unknown as NotionPage;
    } else {
      // Fetch the full page from the API
      logger.info('webhook', `Fetching full page: ${event.externalId}`);
      page = await client.getPage(event.externalId);
    }

    const pageEntity = normalizePage(page, appConfig);
    entities.push(pageEntity);
    return entities;
  }

  // Handle user events
  if (resourceType === 'user') {
    let user: NotionUser;

    // Check if we have full data or need to fetch
    if (hasFullObjectData(event.data)) {
      user = event.data as unknown as NotionUser;
    } else {
      // Fetch the full user from the API
      logger.info('webhook', `Fetching full user: ${event.externalId}`);
      user = await client.getUser(event.externalId);
    }

    const userEntity = normalizeUser(user, appConfig);
    entities.push(userEntity);
    return entities;
  }

  // For other resource types, just normalize the single entity
  const entity = normalizeNotionEntity(resourceType, event.data, appConfig);
  entities.push(entity);

  return entities;
}
