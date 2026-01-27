/**
 * Stripe Connector
 *
 * Implements the connector interface for Stripe integration.
 * Supports webhooks, full sync, and incremental sync for:
 * - Customers
 * - Products
 * - Prices
 * - Plans (legacy)
 * - Subscriptions
 * - Subscription Items
 */

import Stripe from 'stripe';
import type {
  AppConfig,
  ConnectorMetadata,
  NormalizedEntity,
  ParsedWebhookEvent,
  SupportedResource,
  SyncOptions,
  SyncResult,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../types/index.ts';
import {
  registerConnector,
  type IncrementalConnector,
} from '../index.ts';
import {
  createConnectorLogger,
  createNormalizedEntity,
  createTimer,
  emptySyncResult,
  failedSyncResult,
  mergeSyncResults,
} from '../utils.ts';
import {
  upsertEntities,
  deleteEntity,
  getEntityExternalIds,
  type UpsertEntityData,
} from '../../db.ts';
import {
  type StripeAppConfig,
  type StripeResourceType,
  STRIPE_COLLECTION_KEYS,
  STRIPE_WEBHOOK_EVENTS,
  type StripeWebhookEventType,
} from './types.ts';

// =============================================================================
// Constants
// =============================================================================

const CONNECTOR_NAME = 'stripe';
const CONNECTOR_VERSION = '1.0.0';
const DEFAULT_API_VERSION = '2025-02-24.acacia';
const DEFAULT_PAGE_SIZE = 100;

const logger = createConnectorLogger(CONNECTOR_NAME);

// =============================================================================
// Supported Resources
// =============================================================================

const SUPPORTED_RESOURCES: SupportedResource[] = [
  {
    resourceType: 'customer',
    collectionKey: STRIPE_COLLECTION_KEYS.customer,
    description: 'Stripe customers',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'product',
    collectionKey: STRIPE_COLLECTION_KEYS.product,
    description: 'Stripe products',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'price',
    collectionKey: STRIPE_COLLECTION_KEYS.price,
    description: 'Stripe prices',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'plan',
    collectionKey: STRIPE_COLLECTION_KEYS.plan,
    description: 'Stripe plans (legacy)',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'subscription',
    collectionKey: STRIPE_COLLECTION_KEYS.subscription,
    description: 'Stripe subscriptions',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'subscription_item',
    collectionKey: STRIPE_COLLECTION_KEYS.subscription_item,
    description: 'Stripe subscription items',
    supportsIncrementalSync: false,
    supportsWebhooks: false,
  },
];

// =============================================================================
// Connector Metadata
// =============================================================================

const metadata: ConnectorMetadata = {
  name: CONNECTOR_NAME,
  displayName: 'Stripe',
  version: CONNECTOR_VERSION,
  apiVersion: DEFAULT_API_VERSION,
  supportedResources: SUPPORTED_RESOURCES,
  description: 'Syncs customers, products, prices, plans, subscriptions, and subscription items from Stripe',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get Stripe client configuration from app config
 */
function getStripeConfig(appConfig: AppConfig): StripeAppConfig {
  return appConfig.config as StripeAppConfig;
}

/**
 * Get the Stripe API key from environment or config
 */
function getApiKey(appConfig: AppConfig): string {
  const config = getStripeConfig(appConfig);

  // Try environment variable first
  if (config.api_key_env) {
    const apiKey = Deno.env.get(config.api_key_env);
    if (apiKey) return apiKey;
  }

  // Fall back to direct config (not recommended for production)
  if (config.api_key) {
    return config.api_key;
  }

  // Try default environment variable pattern
  const defaultEnvKey = `STRIPE_API_KEY_${appConfig.app_key.toUpperCase()}`;
  const defaultApiKey = Deno.env.get(defaultEnvKey);
  if (defaultApiKey) return defaultApiKey;

  throw new Error(`No Stripe API key found for app ${appConfig.app_key}`);
}

/**
 * Get the webhook signing secret from environment or config
 */
function getWebhookSecret(appConfig: AppConfig): string {
  const config = getStripeConfig(appConfig);

  // Try environment variable first
  if (config.webhook_secret_env) {
    const secret = Deno.env.get(config.webhook_secret_env);
    if (secret) return secret;
  }

  // Fall back to direct config
  if (config.webhook_secret) {
    return config.webhook_secret;
  }

  // Try default environment variable pattern
  const defaultEnvKey = `STRIPE_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`;
  const defaultSecret = Deno.env.get(defaultEnvKey);
  if (defaultSecret) return defaultSecret;

  throw new Error(`No Stripe webhook secret found for app ${appConfig.app_key}`);
}

/**
 * Create a Stripe client for the given app configuration
 */
function createStripeClient(appConfig: AppConfig): Stripe {
  const apiKey = getApiKey(appConfig);
  return new Stripe(apiKey, {
    apiVersion: DEFAULT_API_VERSION,
    typescript: true,
  });
}

/**
 * Get resource types to sync from config or defaults
 */
function getResourceTypesToSync(appConfig: AppConfig): StripeResourceType[] {
  const config = getStripeConfig(appConfig);
  if (config.sync_resources && config.sync_resources.length > 0) {
    return config.sync_resources;
  }
  // Default to all resources except subscription_item (synced with subscriptions)
  return ['customer', 'product', 'price', 'plan', 'subscription'];
}

// =============================================================================
// Entity Normalization
// =============================================================================

/**
 * Detect archived state for a Stripe object based on resource type
 */
function detectArchivedAt(
  resourceType: StripeResourceType,
  data: Record<string, unknown>
): Date | undefined {
  switch (resourceType) {
    case 'customer':
      // Customers with deleted: true should be physically deleted, not archived
      return undefined;

    case 'product':
    case 'price':
    case 'plan':
      // Products, prices, and plans use active: false for soft delete
      if (data.active === false) {
        return new Date();
      }
      return undefined;

    case 'subscription':
      // Subscriptions use status: canceled for soft delete
      if (data.status === 'canceled') {
        // Try to use canceled_at timestamp if available
        const canceledAt = data.canceled_at;
        if (typeof canceledAt === 'number') {
          return new Date(canceledAt * 1000);
        }
        return new Date();
      }
      return undefined;

    case 'subscription_item':
      return undefined;

    default:
      return undefined;
  }
}

/**
 * Normalize a Stripe object to the canonical entity format
 */
function normalizeStripeEntity(
  resourceType: StripeResourceType,
  data: Record<string, unknown>,
  appConfig: AppConfig
): NormalizedEntity {
  const externalId = data.id as string;
  const collectionKey = STRIPE_COLLECTION_KEYS[resourceType];
  const archivedAt = detectArchivedAt(resourceType, data);

  return createNormalizedEntity({
    externalId,
    appKey: appConfig.app_key,
    collectionKey,
    rawPayload: data,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt,
  });
}

// =============================================================================
// Webhook Handling
// =============================================================================

/**
 * Verify incoming webhook signature using Stripe SDK
 */
async function verifyWebhook(
  request: Request,
  appConfig: AppConfig
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

    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

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

/**
 * Parse a verified webhook event into our normalized format
 */
// deno-lint-ignore require-await
async function parseWebhookEvent(
  payload: unknown,
  _appConfig: AppConfig
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

/**
 * Extract and normalize entity from webhook event
 */
// deno-lint-ignore require-await
async function extractEntity(
  event: ParsedWebhookEvent,
  appConfig: AppConfig
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

// =============================================================================
// Sync Implementation
// =============================================================================

/**
 * Convert NormalizedEntity to UpsertEntityData
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
 * Sync customers from Stripe
 */
async function syncCustomers(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.CustomerListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(since && { created: { gte: Math.floor(since.getTime() / 1000) } }),
      };

      const customers = await stripe.customers.list(params);

      const entities: UpsertEntityData[] = [];
      for (const customer of customers.data) {
        seenIds.add(customer.id);
        const entity = normalizeStripeEntity(
          'customer',
          customer as unknown as Record<string, unknown>,
          appConfig
        );
        entities.push(toUpsertData(entity));
      }

      if (entities.length > 0) {
        const { data: upserted, error } = await upsertEntities(entities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else if (upserted) {
          result.created += entities.length; // Simplified count
        }
      }

      hasMore = customers.has_more;
      if (hasMore && customers.data.length > 0) {
        cursor = customers.data[customers.data.length - 1].id;
      }

      // Check limit
      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.customer,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
  }

  return result;
}

/**
 * Sync products from Stripe
 */
async function syncProducts(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.ProductListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(since && { created: { gte: Math.floor(since.getTime() / 1000) } }),
        // Include inactive products
        active: undefined,
      };

      const products = await stripe.products.list(params);

      const entities: UpsertEntityData[] = [];
      for (const product of products.data) {
        seenIds.add(product.id);
        const entity = normalizeStripeEntity(
          'product',
          product as unknown as Record<string, unknown>,
          appConfig
        );
        entities.push(toUpsertData(entity));
      }

      if (entities.length > 0) {
        const { error } = await upsertEntities(entities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else {
          result.created += entities.length;
        }
      }

      hasMore = products.has_more;
      if (hasMore && products.data.length > 0) {
        cursor = products.data[products.data.length - 1].id;
      }

      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.product,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
  }

  return result;
}

/**
 * Sync prices from Stripe
 */
async function syncPrices(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.PriceListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(since && { created: { gte: Math.floor(since.getTime() / 1000) } }),
        // Include inactive prices
        active: undefined,
      };

      const prices = await stripe.prices.list(params);

      const entities: UpsertEntityData[] = [];
      for (const price of prices.data) {
        seenIds.add(price.id);
        const entity = normalizeStripeEntity(
          'price',
          price as unknown as Record<string, unknown>,
          appConfig
        );
        entities.push(toUpsertData(entity));
      }

      if (entities.length > 0) {
        const { error } = await upsertEntities(entities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else {
          result.created += entities.length;
        }
      }

      hasMore = prices.has_more;
      if (hasMore && prices.data.length > 0) {
        cursor = prices.data[prices.data.length - 1].id;
      }

      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.price,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
  }

  return result;
}

/**
 * Sync plans from Stripe (legacy)
 */
async function syncPlans(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.PlanListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(since && { created: { gte: Math.floor(since.getTime() / 1000) } }),
        // Include inactive plans
        active: undefined,
      };

      const plans = await stripe.plans.list(params);

      const entities: UpsertEntityData[] = [];
      for (const plan of plans.data) {
        seenIds.add(plan.id);
        const entity = normalizeStripeEntity(
          'plan',
          plan as unknown as Record<string, unknown>,
          appConfig
        );
        entities.push(toUpsertData(entity));
      }

      if (entities.length > 0) {
        const { error } = await upsertEntities(entities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else {
          result.created += entities.length;
        }
      }

      hasMore = plans.has_more;
      if (hasMore && plans.data.length > 0) {
        cursor = plans.data[plans.data.length - 1].id;
      }

      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.plan,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
  }

  return result;
}

/**
 * Sync subscriptions from Stripe (also syncs subscription items)
 */
async function syncSubscriptions(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  existingItemIds?: Set<string>
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();
  const seenItemIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.SubscriptionListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(since && { created: { gte: Math.floor(since.getTime() / 1000) } }),
        // Include all subscription statuses
        status: 'all',
        // Expand items to get subscription items
        expand: ['data.items'],
      };

      const subscriptions = await stripe.subscriptions.list(params);

      const subEntities: UpsertEntityData[] = [];
      const itemEntities: UpsertEntityData[] = [];

      for (const subscription of subscriptions.data) {
        seenIds.add(subscription.id);

        // Normalize subscription
        const subEntity = normalizeStripeEntity(
          'subscription',
          subscription as unknown as Record<string, unknown>,
          appConfig
        );
        subEntities.push(toUpsertData(subEntity));

        // Extract and normalize subscription items
        if (subscription.items && subscription.items.data) {
          for (const item of subscription.items.data) {
            seenItemIds.add(item.id);
            const itemEntity = normalizeStripeEntity(
              'subscription_item',
              item as unknown as Record<string, unknown>,
              appConfig
            );
            itemEntities.push(toUpsertData(itemEntity));
          }
        }
      }

      // Upsert subscriptions
      if (subEntities.length > 0) {
        const { error } = await upsertEntities(subEntities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else {
          result.created += subEntities.length;
        }
      }

      // Upsert subscription items
      if (itemEntities.length > 0) {
        const { error } = await upsertEntities(itemEntities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(error.message);
        } else {
          result.created += itemEntities.length;
        }
      }

      hasMore = subscriptions.has_more;
      if (hasMore && subscriptions.data.length > 0) {
        cursor = subscriptions.data[subscriptions.data.length - 1].id;
      }

      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    // Detect deleted subscription items during full sync
    if (!since && existingItemIds) {
      for (const existingId of existingItemIds) {
        if (!seenItemIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription_item,
            existingId
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
  }

  return result;
}

/**
 * Perform a full sync of all configured resources
 */
async function fullSync(
  appConfig: AppConfig,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const timer = createTimer();
  const stripe = createStripeClient(appConfig);
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);

  logger.syncStarted('full', resourceTypes);

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    // Get existing IDs for deletion detection
    const collectionKey = STRIPE_COLLECTION_KEYS[resourceType as StripeResourceType];
    const { data: existingIds } = await getEntityExternalIds(appConfig.app_key, collectionKey);

    let syncResult: SyncResult;

    switch (resourceType) {
      case 'customer':
        syncResult = await syncCustomers(stripe, appConfig, options, existingIds ?? undefined);
        break;
      case 'product':
        syncResult = await syncProducts(stripe, appConfig, options, existingIds ?? undefined);
        break;
      case 'price':
        syncResult = await syncPrices(stripe, appConfig, options, existingIds ?? undefined);
        break;
      case 'plan':
        syncResult = await syncPlans(stripe, appConfig, options, existingIds ?? undefined);
        break;
      case 'subscription': {
        // Also get existing subscription item IDs
        const { data: existingItemIds } = await getEntityExternalIds(
          appConfig.app_key,
          STRIPE_COLLECTION_KEYS.subscription_item
        );
        syncResult = await syncSubscriptions(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          existingItemIds ?? undefined
        );
        break;
      }
      default:
        syncResult = failedSyncResult(`Unknown resource type: ${resourceType}`);
    }

    results.push(syncResult);
  }

  const merged = mergeSyncResults(results);
  merged.durationMs = timer.elapsed();

  logger.syncCompleted(merged);
  return merged;
}

/**
 * Perform an incremental sync since the last sync time
 */
async function incrementalSync(
  appConfig: AppConfig,
  since: Date,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const timer = createTimer();
  const stripe = createStripeClient(appConfig);
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);

  logger.syncStarted('incremental', resourceTypes);

  const syncOptions: SyncOptions = {
    ...options,
    since,
  };

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    let syncResult: SyncResult;

    switch (resourceType) {
      case 'customer':
        syncResult = await syncCustomers(stripe, appConfig, syncOptions);
        break;
      case 'product':
        syncResult = await syncProducts(stripe, appConfig, syncOptions);
        break;
      case 'price':
        syncResult = await syncPrices(stripe, appConfig, syncOptions);
        break;
      case 'plan':
        syncResult = await syncPlans(stripe, appConfig, syncOptions);
        break;
      case 'subscription':
        syncResult = await syncSubscriptions(stripe, appConfig, syncOptions);
        break;
      default:
        syncResult = failedSyncResult(`Unknown resource type: ${resourceType}`);
    }

    results.push(syncResult);
  }

  const merged = mergeSyncResults(results);
  merged.durationMs = timer.elapsed();

  logger.syncCompleted(merged);
  return merged;
}

// =============================================================================
// Connector Implementation
// =============================================================================

/**
 * Stripe connector implementation
 */
const stripeConnector: IncrementalConnector = {
  metadata,

  verifyWebhook,
  parseWebhookEvent,
  extractEntity,

  normalizeEntity(
    resourceType: string,
    data: Record<string, unknown>,
    config: AppConfig
  ): NormalizedEntity {
    return normalizeStripeEntity(resourceType as StripeResourceType, data, config);
  },

  fullSync,
  incrementalSync,
};

// =============================================================================
// Registration
// =============================================================================

// Register the connector with the registry
registerConnector(CONNECTOR_NAME, () => stripeConnector);

// Export for direct use
export default stripeConnector;
export { stripeConnector, metadata };
