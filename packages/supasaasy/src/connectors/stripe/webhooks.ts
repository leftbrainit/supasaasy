/**
 * Stripe Webhooks Module
 *
 * Handles webhook verification, parsing, and entity extraction.
 */

import type Stripe from 'stripe';
import type {
  AppConfig,
  NormalizedEntity,
  ParsedWebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../types/index.ts';
import { createStripeClient, getWebhookSecret, logger } from './client.ts';
import { normalizeStripeEntity } from './normalization.ts';
import {
  STRIPE_WEBHOOK_EVENTS,
  type StripeResourceType,
  type StripeWebhookEventType,
} from './types.ts';

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Verify incoming webhook signature using Stripe SDK
 */
export async function verifyWebhook(
  request: Request,
  appConfig: AppConfig,
): Promise<WebhookVerificationResult> {
  try {
    const webhookSecret = getWebhookSecret(appConfig);
    const stripe = createStripeClient(appConfig);

    // Get the raw body as text
    const body = await request.text();

    // Get the signature header
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return {
        valid: false,
        reason: 'Missing Stripe-Signature header',
      };
    }

    // Verify the webhook signature (use async version for Deno/Edge environments)
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    return {
      valid: true,
      payload: event,
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
  const event = payload as Stripe.Event;
  const eventType = event.type as StripeWebhookEventType;

  // Get mapping for this event type
  const mapping = STRIPE_WEBHOOK_EVENTS[eventType];
  if (!mapping) {
    // Unknown event type, treat as update
    logger.warn('webhook', `Unknown event type: ${eventType}`);
    return {
      eventType: 'update',
      originalEventType: eventType,
      resourceType: 'unknown',
      externalId: '',
      data: event.data.object as unknown as Record<string, unknown>,
      timestamp: new Date(event.created * 1000),
      metadata: { livemode: event.livemode },
    };
  }

  const data = event.data.object as unknown as Record<string, unknown>;
  const externalId = data.id as string;

  return {
    eventType: mapping.eventType as WebhookEventType,
    originalEventType: eventType,
    resourceType: mapping.resourceType,
    externalId,
    data,
    timestamp: new Date(event.created * 1000),
    metadata: {
      livemode: event.livemode,
      api_version: event.api_version,
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
  // Skip unknown resource types
  if (event.resourceType === 'unknown') {
    return null;
  }

  // For delete events on customers, we don't need entity data
  if (event.eventType === 'delete' && event.resourceType === 'customer') {
    return null;
  }

  const resourceType = event.resourceType as StripeResourceType;
  return normalizeStripeEntity(resourceType, event.data, appConfig);
}

/**
 * Extract and normalize multiple entities from webhook event.
 * Handles nested resources like subscription items within subscriptions.
 */
// deno-lint-ignore require-await
export async function extractEntities(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity[]> {
  const entities: NormalizedEntity[] = [];

  // Skip unknown resource types
  if (event.resourceType === 'unknown') {
    return entities;
  }

  // For delete events on customers, we don't need entity data
  if (event.eventType === 'delete' && event.resourceType === 'customer') {
    return entities;
  }

  const resourceType = event.resourceType as StripeResourceType;

  // Add the main entity
  const mainEntity = normalizeStripeEntity(resourceType, event.data, appConfig);
  entities.push(mainEntity);

  // For subscription events, also extract subscription items
  if (resourceType === 'subscription') {
    const subscriptionData = event.data;

    // Check if items are embedded in the subscription data
    // Items come as { object: 'list', data: [...], has_more: boolean, url: string }
    const items = subscriptionData.items as {
      object?: string;
      data?: Array<Record<string, unknown>>;
      has_more?: boolean;
    } | undefined;

    if (items && items.data && Array.isArray(items.data)) {
      logger.info(
        'webhook',
        `Subscription ${subscriptionData.id} has ${items.data.length} embedded item(s)`,
      );

      for (const item of items.data) {
        const itemEntity = normalizeStripeEntity('subscription_item', item, appConfig);
        entities.push(itemEntity);
      }

      // Warn if there are more items than what's embedded (pagination issue)
      if (items.has_more) {
        logger.warn(
          'webhook',
          `Subscription ${subscriptionData.id} has more items than embedded in webhook. ` +
            `Consider running a full sync to capture all items.`,
        );
      }
    } else {
      logger.warn(
        'webhook',
        `Subscription ${subscriptionData.id} has no embedded items in webhook payload`,
      );
    }
  }

  return entities;
}
