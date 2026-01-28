/**
 * Stripe Resource Sync Functions
 *
 * Individual sync functions for each Stripe resource type.
 */

import type Stripe from 'stripe';
import type { AppConfig, NormalizedEntity, SyncOptions, SyncResult } from '../../../types/index.ts';
import {
  deleteEntity,
  upsertEntities,
  type UpsertEntityData,
} from '../../../db/index.ts';
import { createTimer, emptySyncResult } from '../../utils.ts';
import { DEFAULT_PAGE_SIZE, logger } from '../client.ts';
import { normalizeStripeEntity } from '../normalization.ts';
import { STRIPE_COLLECTION_KEYS } from '../types.ts';

// =============================================================================
// Helper Functions
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

// =============================================================================
// Resource Sync Functions
// =============================================================================

/**
 * Sync customers from Stripe
 */
export async function syncCustomers(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  // For full sync, use syncFromTimestamp as the floor if configured
  const createdGte = since ? Math.floor(since.getTime() / 1000) : syncFromTimestamp;

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.CustomerListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(createdGte && { created: { gte: createdGte } }),
      };

      const customers = await stripe.customers.list(params);

      const entities: UpsertEntityData[] = [];
      for (const customer of customers.data) {
        seenIds.add(customer.id);
        const entity = normalizeStripeEntity(
          'customer',
          customer as unknown as Record<string, unknown>,
          appConfig,
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

    // Detect deletions during full sync (only for records in sync window)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.customer,
            existingId,
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
export async function syncProducts(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  // For full sync, use syncFromTimestamp as the floor if configured
  const createdGte = since ? Math.floor(since.getTime() / 1000) : syncFromTimestamp;

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.ProductListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(createdGte && { created: { gte: createdGte } }),
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
          appConfig,
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

    // Detect deletions during full sync (only for records in sync window)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.product,
            existingId,
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
export async function syncPrices(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  // For full sync, use syncFromTimestamp as the floor if configured
  const createdGte = since ? Math.floor(since.getTime() / 1000) : syncFromTimestamp;

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.PriceListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(createdGte && { created: { gte: createdGte } }),
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
          appConfig,
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

    // Detect deletions during full sync (only for records in sync window)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.price,
            existingId,
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
export async function syncPlans(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();

  // For full sync, use syncFromTimestamp as the floor if configured
  const createdGte = since ? Math.floor(since.getTime() / 1000) : syncFromTimestamp;

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.PlanListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(createdGte && { created: { gte: createdGte } }),
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
          appConfig,
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

    // Detect deletions during full sync (only for records in sync window)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.plan,
            existingId,
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
 * Fetch all subscription items for a subscription, handling pagination
 */
async function fetchAllSubscriptionItems(
  stripe: Stripe,
  subscriptionId: string,
): Promise<Stripe.SubscriptionItem[]> {
  const items: Stripe.SubscriptionItem[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params: Stripe.SubscriptionItemListParams = {
      subscription: subscriptionId,
      limit: DEFAULT_PAGE_SIZE,
      ...(cursor && { starting_after: cursor }),
    };

    const response = await stripe.subscriptionItems.list(params);
    items.push(...response.data);

    hasMore = response.has_more;
    if (hasMore && response.data.length > 0) {
      cursor = response.data[response.data.length - 1].id;
    }
  }

  return items;
}

/**
 * Extract subscription items from embedded data or fetch separately if needed
 */
async function getSubscriptionItems(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<Stripe.SubscriptionItem[]> {
  // Check if items are embedded in the subscription response
  if (subscription.items && subscription.items.data && subscription.items.data.length > 0) {
    // If there are more items than returned, fetch all items separately
    if (subscription.items.has_more) {
      logger.info(
        'sync',
        `Subscription ${subscription.id} has more items than initially returned, fetching all items`,
      );
      return await fetchAllSubscriptionItems(stripe, subscription.id);
    }
    return subscription.items.data;
  }

  // Items not embedded or empty - fetch them separately
  // This handles edge cases where items might not be returned with the subscription
  logger.info('sync', `Subscription ${subscription.id} has no embedded items, fetching separately`);
  return await fetchAllSubscriptionItems(stripe, subscription.id);
}

/**
 * Sync subscriptions from Stripe (also syncs subscription items)
 */
export async function syncSubscriptions(
  stripe: Stripe,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  existingItemIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor = options.cursor;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const since = options.since;
  const seenIds = new Set<string>();
  const seenItemIds = new Set<string>();

  // For full sync, use syncFromTimestamp as the floor if configured
  const createdGte = since ? Math.floor(since.getTime() / 1000) : syncFromTimestamp;

  try {
    let hasMore = true;
    while (hasMore) {
      const params: Stripe.SubscriptionListParams = {
        limit: pageSize,
        ...(cursor && { starting_after: cursor }),
        ...(createdGte && { created: { gte: createdGte } }),
        // Include all subscription statuses
        status: 'all',
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
          appConfig,
        );
        subEntities.push(toUpsertData(subEntity));

        // Fetch and normalize subscription items
        const items = await getSubscriptionItems(stripe, subscription);

        if (items.length === 0) {
          logger.warn('sync', `Subscription ${subscription.id} has no items`);
        } else {
          logger.info('sync', `Subscription ${subscription.id} has ${items.length} item(s)`);
        }

        for (const item of items) {
          seenItemIds.add(item.id);
          const itemEntity = normalizeStripeEntity(
            'subscription_item',
            item as unknown as Record<string, unknown>,
            appConfig,
          );
          itemEntities.push(toUpsertData(itemEntity));
        }
      }

      // Upsert subscriptions
      if (subEntities.length > 0) {
        const { error } = await upsertEntities(subEntities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(`Failed to upsert subscriptions: ${error.message}`);
          logger.error('sync', `Failed to upsert subscriptions: ${error.message}`);
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
          result.errorMessages.push(`Failed to upsert subscription items: ${error.message}`);
          logger.error('sync', `Failed to upsert subscription items: ${error.message}`);
        } else {
          result.created += itemEntities.length;
          logger.info('sync', `Successfully synced ${itemEntities.length} subscription item(s)`);
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

    // Detect deletions during full sync (only for records in sync window)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription,
            existingId,
          );
          if (error) {
            result.errors++;
          } else {
            result.deleted++;
          }
        }
      }
    }

    // Detect deleted subscription items during full sync (only for records in sync window)
    if (!since && existingItemIds) {
      for (const existingId of existingItemIds) {
        if (!seenItemIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription_item,
            existingId,
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
    logger.error('sync', `Subscription sync failed: ${message}`);
  }

  return result;
}
