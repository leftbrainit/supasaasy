/**
 * Intercom Sync Module
 *
 * Orchestrates full and incremental sync operations across all resource types.
 */

import type { AppConfig, SyncOptions, SyncResult } from '../../../types/index.ts';
import {
  getEntityExternalIds,
  getEntityExternalIdsCreatedAfter,
} from '../../../db.ts';
import { createTimer, failedSyncResult, mergeSyncResults } from '../../utils.ts';
import {
  createIntercomClient,
  getResourceTypesToSync,
  getSyncFromTimestamp,
  logger,
} from '../client.ts';
import { INTERCOM_COLLECTION_KEYS, type IntercomResourceType } from '../types.ts';
import {
  syncAdmins,
  syncCompanies,
  syncContacts,
  syncConversations,
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
  const client = createIntercomClient(appConfig);
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
    const collectionKey = INTERCOM_COLLECTION_KEYS[resourceType as IntercomResourceType];
    const { data: existingIds } = syncFromTimestamp
      ? await getEntityExternalIdsCreatedAfter(appConfig.app_key, collectionKey, syncFromTimestamp)
      : await getEntityExternalIds(appConfig.app_key, collectionKey);

    let syncResult: SyncResult;

    switch (resourceType) {
      case 'company':
        syncResult = await syncCompanies(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'contact':
        syncResult = await syncContacts(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      case 'admin':
        // Admins don't support sync_from (no created_at filtering available)
        syncResult = await syncAdmins(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
        );
        break;
      case 'conversation': {
        // Also get existing conversation part IDs (filtered by sync_from if configured)
        const { data: existingPartIds } = syncFromTimestamp
          ? await getEntityExternalIdsCreatedAfter(
            appConfig.app_key,
            INTERCOM_COLLECTION_KEYS.conversation_part,
            syncFromTimestamp,
          )
          : await getEntityExternalIds(
            appConfig.app_key,
            INTERCOM_COLLECTION_KEYS.conversation_part,
          );
        syncResult = await syncConversations(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
          existingPartIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      }
      case 'conversation_part':
        // Conversation parts are synced with conversations, skip standalone sync
        logger.info('sync', 'Skipping conversation_part (synced with conversations)');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
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
  const client = createIntercomClient(appConfig);
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
      case 'company':
        // Intercom companies don't support incremental sync via API
        // We can only do full sync for companies
        logger.warn('sync', 'Company incremental sync not supported, skipping');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
        break;
      case 'contact':
        // Intercom contacts don't support incremental sync via API
        // We can only do full sync for contacts
        logger.warn('sync', 'Contact incremental sync not supported, skipping');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
        break;
      case 'admin':
        // Admins don't change frequently, do a full sync
        syncResult = await syncAdmins(client, appConfig, syncOptions);
        break;
      case 'conversation':
        // Conversations support incremental sync via the search endpoint
        syncResult = await syncConversations(client, appConfig, syncOptions);
        break;
      case 'conversation_part':
        // Conversation parts are synced with conversations, skip standalone sync
        logger.info('sync', 'Skipping conversation_part (synced with conversations)');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
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
