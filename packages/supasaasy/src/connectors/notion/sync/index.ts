/**
 * Notion Sync Module
 *
 * Orchestrates full and incremental sync operations across all resource types.
 */

import type { AppConfig, SyncOptions, SyncResult } from '../../../types/index.ts';
import { getEntityExternalIds, getEntityExternalIdsCreatedAfter } from '../../../db/index.ts';
import { createTimer, failedSyncResult, mergeSyncResults } from '../../utils.ts';
import {
  createNotionClient,
  getResourceTypesToSync,
  getSyncFromTimestamp,
  logger,
} from '../client.ts';
import { NOTION_COLLECTION_KEYS } from '../types.ts';
import { syncDataSources, syncPages, syncUsers } from './resources.ts';

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
  const client = createNotionClient(appConfig);
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);
  const syncFromTimestamp = getSyncFromTimestamp(appConfig);

  // Log if sync_from is active
  if (syncFromTimestamp) {
    logger.info(
      'sync',
      `sync_from configured: syncing records created on or after ${syncFromTimestamp}`,
    );
  }

  logger.syncStarted('full', resourceTypes);

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    let syncResult: SyncResult;

    switch (resourceType) {
      case 'data_source': {
        // Get existing IDs for deletion detection
        // When sync_from is configured, only get IDs of records created after that timestamp
        const { data: existingIds } = syncFromTimestamp
          ? await getEntityExternalIdsCreatedAfter(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.data_source,
            Math.floor(new Date(syncFromTimestamp).getTime() / 1000),
          )
          : await getEntityExternalIds(appConfig.app_key, NOTION_COLLECTION_KEYS.data_source);

        // Also get existing property IDs
        const { data: existingPropertyIds } = syncFromTimestamp
          ? await getEntityExternalIdsCreatedAfter(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.data_source_property,
            Math.floor(new Date(syncFromTimestamp).getTime() / 1000),
          )
          : await getEntityExternalIds(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.data_source_property,
          );

        syncResult = await syncDataSources(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
          existingPropertyIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      }

      case 'data_source_property':
        // Data source properties are synced with data sources, skip standalone sync
        logger.info('sync', 'Skipping data_source_property (synced with data_sources)');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
        break;

      case 'page': {
        // Get existing IDs for deletion detection
        const { data: existingIds } = syncFromTimestamp
          ? await getEntityExternalIdsCreatedAfter(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.page,
            Math.floor(new Date(syncFromTimestamp).getTime() / 1000),
          )
          : await getEntityExternalIds(appConfig.app_key, NOTION_COLLECTION_KEYS.page);

        syncResult = await syncPages(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
          syncFromTimestamp,
        );
        break;
      }

      case 'user': {
        // Get existing IDs for deletion detection
        // Note: Users don't support sync_from filtering
        const { data: existingIds } = await getEntityExternalIds(
          appConfig.app_key,
          NOTION_COLLECTION_KEYS.user,
        );

        syncResult = await syncUsers(
          client,
          appConfig,
          options,
          existingIds ?? undefined,
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
  const client = createNotionClient(appConfig);
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
      case 'data_source':
        // Data sources don't support direct incremental sync via API
        // We would need to track changes via webhooks or do a full sync
        logger.warn('sync', 'Data source incremental sync not supported, skipping');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
        break;

      case 'data_source_property':
        // Properties are synced with data sources
        logger.info('sync', 'Skipping data_source_property (synced with data_sources)');
        syncResult = { success: true, created: 0, updated: 0, deleted: 0, errors: 0 };
        break;

      case 'page':
        // Pages support incremental sync via last_edited_time filter
        syncResult = await syncPages(client, appConfig, syncOptions);
        break;

      case 'user':
        // Users don't support incremental sync, do a full sync
        syncResult = await syncUsers(client, appConfig, syncOptions);
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
