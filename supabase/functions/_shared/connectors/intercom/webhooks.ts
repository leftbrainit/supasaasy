/**
 * Intercom Webhooks Module
 *
 * Handles webhook verification, parsing, and entity extraction.
 * Intercom uses HMAC SHA-1 for webhook signature verification with the X-Hub-Signature header.
 */

import type {
  AppConfig,
  NormalizedEntity,
  ParsedWebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../types/index.ts';
import { getWebhookSecret, logger } from './client.ts';
import { normalizeIntercomEntity } from './normalization.ts';
import {
  INTERCOM_WEBHOOK_EVENTS,
  type IntercomConversation,
  type IntercomResourceType,
  type IntercomWebhookEventType,
  type IntercomWebhookPayload,
} from './types.ts';

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Compute HMAC SHA-1 signature for Intercom webhook verification
 */
async function computeHmacSha1(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return `sha1=${hashHex}`;
}

/**
 * Verify incoming webhook signature using HMAC SHA-1
 * Intercom signs webhooks using the app's client_secret
 */
export async function verifyWebhook(
  request: Request,
  appConfig: AppConfig,
): Promise<WebhookVerificationResult> {
  try {
    const webhookSecret = getWebhookSecret(appConfig);
    const body = await request.text();

    // Get the signature header
    const signature = request.headers.get('X-Hub-Signature');
    if (!signature) {
      return {
        valid: false,
        reason: 'Missing X-Hub-Signature header',
      };
    }

    // Compute expected signature
    const expectedSignature = await computeHmacSha1(webhookSecret, body);

    // Compare signatures (constant-time comparison would be better, but this is sufficient)
    if (signature !== expectedSignature) {
      logger.warn('webhook', 'Signature mismatch', {
        received: signature.substring(0, 20) + '...',
        expected: expectedSignature.substring(0, 20) + '...',
      });
      return {
        valid: false,
        reason: 'Invalid webhook signature',
      };
    }

    // Parse the payload
    const payload = JSON.parse(body) as IntercomWebhookPayload;

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
  const event = payload as IntercomWebhookPayload;
  const topic = event.topic as IntercomWebhookEventType;

  const mapping = INTERCOM_WEBHOOK_EVENTS[topic];
  if (!mapping) {
    logger.warn('webhook', `Unknown event type: ${topic}`);
    return {
      eventType: 'update',
      originalEventType: topic,
      resourceType: 'unknown',
      externalId: '',
      data: event.data?.item ?? {},
      timestamp: event.created_at ? new Date(event.created_at * 1000) : new Date(),
      metadata: {
        app_id: event.app_id,
        delivery_attempts: event.delivery_attempts,
      },
    };
  }

  const data = event.data?.item ?? {};
  const externalId = (data.id as string) ?? '';

  return {
    eventType: mapping.eventType as WebhookEventType,
    originalEventType: topic,
    resourceType: mapping.resourceType,
    externalId,
    data,
    timestamp: event.created_at ? new Date(event.created_at * 1000) : new Date(),
    metadata: {
      app_id: event.app_id,
      delivery_attempts: event.delivery_attempts,
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

  const resourceType = event.resourceType as IntercomResourceType;
  return normalizeIntercomEntity(resourceType, event.data, appConfig);
}

/**
 * Extract and normalize multiple entities from webhook event.
 * Handles conversation parts embedded in conversation events.
 */
// deno-lint-ignore require-await
export async function extractEntities(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity[]> {
  const entities: NormalizedEntity[] = [];

  if (event.resourceType === 'unknown' || event.eventType === 'delete') {
    return entities;
  }

  const resourceType = event.resourceType as IntercomResourceType;

  // Add the main entity
  const mainEntity = normalizeIntercomEntity(resourceType, event.data, appConfig);
  entities.push(mainEntity);

  // For conversation events, also extract conversation parts
  if (resourceType === 'conversation') {
    const conversationData = event.data as unknown as IntercomConversation;
    const parts = conversationData.conversation_parts?.conversation_parts;

    if (parts && Array.isArray(parts) && parts.length > 0) {
      logger.info(
        'webhook',
        `Conversation ${conversationData.id} has ${parts.length} part(s)`,
      );

      for (const part of parts) {
        // Add conversation_id to the part for reference
        const partData = {
          ...part,
          conversation_id: conversationData.id,
        };
        const partEntity = normalizeIntercomEntity('conversation_part', partData, appConfig);
        entities.push(partEntity);
      }
    }
  }

  return entities;
}
