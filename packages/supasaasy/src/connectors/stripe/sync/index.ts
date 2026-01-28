/**
 * Stripe Sync Module
 *
 * Orchestrates full and incremental sync operations across all resource types.
 */

import type { AppConfig, SyncOptions, SyncResult } from '../../../types/index.ts';
import { getEntityExternalIds, getEntityExternalIdsCreatedAfter } from '../../../db/index.ts';
import { createTimer, failedSyncResult, mergeSyncResults } from '../../utils.ts';
import {
  createStripeClient,
  getResourceTypesToSync,
  getSyncFromTimestamp,
  logger,
} from '../client.ts';
import { STRIPE_COLLECTION_KEYS, type StripeResourceType } from '../types.ts';
import {
  syncCustomers,
  syncPlans,
  syncPrices,
  syncProducts,
  syncSubscriptions,
} from './resources.ts';

// =============================================================================
// Full Sync
// =============================================================================

/**
 * Perform a full sync of all configured resources
 */
export async function fullSync(
  appConfig: AppConfig,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const timer = createTimer();
  const stripe = createStripeClient(appConfig);
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);
  const syncFromTimestamp = getSyncFromTimestamp(appConfig);

  // Log if sync_from is active
  if (syncFromTimestamp) {
    const syncFromDate = new Date(syncFromTimestamp * 1000).toISOString();
    logger.info(
      'sync',
      `sync_from configured: syncing records created on or after ${syncFromDate}`,
    );
  }

  logger.syncStarted('full', resourceTypes);

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    // Get existing IDs for deletion detection
    // When sync_from is configured, only get IDs of records created after that timestamp
    const collectionKey = STRIPE_COLLECTION_KEYS[resourceType as StripeResourceType];
    const { data: existingIds } = syncFromTimestamp
      ? await getEntityExternalIdsCreatedAfter(appConfig.app_key, collectionKey, syncFromTimestamp)
      : await getEntityExternalIds(appConfig.app_key, collectionKey);

    let syncResult: SyncResult;

    switch (resourceType) {
      case 'customer':
        syncResult = await syncCustomers(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'product':
        syncResult = await syncProducts(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'price':
        syncResult = await syncPrices(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'plan':
        syncResult = await syncPlans(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'subscription': {
        // Also get existing subscription item IDs (filtered by sync_from if configured)
        // Note: subscription items don't have their own 'created' field, so we filter by parent subscription
        const { data: existingItemIds } = syncFromTimestamp
          ? await getEntityExternalIdsCreatedAfter(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription_item,
            syncFromTimestamp,
          )
          : await getEntityExternalIds(
            appConfig.app_key,
            STRIPE_COLLECTION_KEYS.subscription_item,
          );
        syncResult = await syncSubscriptions(
          stripe,
          appConfig,
          options,
          existingIds ?? undefined,
          existingItemIds ?? undefined,
          syncFromTimestamp,
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

// =============================================================================
// Incremental Sync
// =============================================================================

/**
 * Perform an incremental sync since the last sync time
 */
export async function incrementalSync(
  appConfig: AppConfig,
  since: Date,
  options: SyncOptions = {},
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
