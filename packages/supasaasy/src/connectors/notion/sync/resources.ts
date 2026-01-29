/**
 * Notion Resource Sync Functions
 *
 * Individual sync functions for each Notion resource type.
 */

import type { AppConfig, NormalizedEntity, SyncOptions, SyncResult } from '../../../types/index.ts';
import { deleteEntity, upsertEntities, type UpsertEntityData } from '../../../db/index.ts';
import { createTimer, emptySyncResult } from '../../utils.ts';
import { DEFAULT_PAGE_SIZE, logger, type NotionClient } from '../client.ts';
import {
  extractDataSourceProperties,
  normalizeDataSource,
  normalizePage,
  normalizeUser,
} from '../normalization.ts';
import { NOTION_COLLECTION_KEYS } from '../types.ts';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert NormalizedEntity to UpsertEntityData
 * Includes the id field if present (for Notion UUID as entity id)
 */
function toUpsertData(entity: NormalizedEntity): UpsertEntityData {
  const data: UpsertEntityData = {
    external_id: entity.externalId,
    app_key: entity.appKey,
    collection_key: entity.collectionKey,
    raw_payload: entity.rawPayload,
    api_version: entity.apiVersion,
    archived_at: entity.archivedAt?.toISOString() ?? null,
  };

  // Include custom id if present (Notion UUIDs for data sources, pages, users)
  if (entity.id) {
    data.id = entity.id;
  }

  return data;
}

/**
 * Check if a timestamp is on or after the sync_from timestamp
 */
function isAfterSyncFrom(timestamp: string, syncFrom?: string): boolean {
  if (!syncFrom) return true;
  return new Date(timestamp) >= new Date(syncFrom);
}

// =============================================================================
// Data Source Sync
// =============================================================================

/**
 * Sync data sources from Notion (also syncs data source properties)
 */
export async function syncDataSources(
  client: NotionClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  existingPropertyExternalIds?: Set<string>,
  syncFromTimestamp?: string,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor: string | undefined;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();
  const seenPropertyExternalIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const response = await client.searchDataSources(cursor, pageSize);

      const dataSourceEntities: UpsertEntityData[] = [];
      const propertyEntities: UpsertEntityData[] = [];

      for (const dataSource of response.results) {
        // Filter by sync_from if configured (only for full sync)
        if (syncFromTimestamp && !options.since) {
          if (!isAfterSyncFrom(dataSource.created_time, syncFromTimestamp)) {
            continue;
          }
        }

        seenIds.add(dataSource.id);

        // Fetch full data source details to get properties
        const fullDataSource = await client.getDataSource(dataSource.id);

        // Normalize the data source
        const dsEntity = normalizeDataSource(fullDataSource, appConfig);
        dataSourceEntities.push(toUpsertData(dsEntity));

        // Extract and normalize properties
        const properties = extractDataSourceProperties(fullDataSource, appConfig);
        for (const propEntity of properties) {
          seenPropertyExternalIds.add(propEntity.externalId);
          propertyEntities.push(toUpsertData(propEntity));
        }

        logger.info(
          'sync',
          `Data source ${dataSource.id} has ${properties.length} properties`,
        );
      }

      // Upsert data sources
      if (dataSourceEntities.length > 0) {
        const { error } = await upsertEntities(dataSourceEntities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(`Failed to upsert data sources: ${error.message}`);
        } else {
          result.created += dataSourceEntities.length;
        }
      }

      // Upsert properties
      if (propertyEntities.length > 0) {
        const { error } = await upsertEntities(propertyEntities);
        if (error) {
          result.errors++;
          result.errorMessages = result.errorMessages || [];
          result.errorMessages.push(`Failed to upsert properties: ${error.message}`);
        } else {
          result.created += propertyEntities.length;
          logger.info('sync', `Synced ${propertyEntities.length} data source properties`);
        }
      }

      // Check pagination
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;

      // Check limit
      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deleted data sources during full sync
    if (!options.since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.data_source,
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

    // Detect deleted properties during full sync
    if (!options.since && existingPropertyExternalIds) {
      for (const existingExternalId of existingPropertyExternalIds) {
        if (!seenPropertyExternalIds.has(existingExternalId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.data_source_property,
            existingExternalId,
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
    logger.error('sync', `Data source sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// Page Sync
// =============================================================================

/**
 * Sync pages from Notion data sources
 */
export async function syncPages(
  client: NotionClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: string,
  dataSourceIds?: string[],
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();
  const since = options.since;

  try {
    // Get data sources to query
    let dsIds = dataSourceIds;
    if (!dsIds || dsIds.length === 0) {
      // Discover data sources via search
      const searchResponse = await client.searchDataSources(undefined, 100);
      dsIds = searchResponse.results.map((ds) => ds.id);
      logger.info('sync', `Discovered ${dsIds.length} data sources for page sync`);
    }

    // Sync pages from each data source
    for (const dataSourceId of dsIds) {
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore) {
        // Build query with optional last_edited_time filter for incremental sync
        const queryBody: Record<string, unknown> = {
          page_size: pageSize,
        };

        if (cursor) {
          queryBody.start_cursor = cursor;
        }

        // For incremental sync, filter by last_edited_time
        if (since) {
          queryBody.filter = {
            timestamp: 'last_edited_time',
            last_edited_time: {
              on_or_after: since.toISOString(),
            },
          };
          queryBody.sorts = [
            {
              timestamp: 'last_edited_time',
              direction: 'descending',
            },
          ];
        }

        const response = await client.queryDataSource(dataSourceId, queryBody);

        const entities: UpsertEntityData[] = [];

        for (const page of response.results) {
          // Filter by sync_from if configured (only for full sync)
          if (syncFromTimestamp && !since) {
            if (!isAfterSyncFrom(page.created_time, syncFromTimestamp)) {
              continue;
            }
          }

          seenIds.add(page.id);
          const entity = normalizePage(page, appConfig);
          entities.push(toUpsertData(entity));
        }

        if (entities.length > 0) {
          const { error } = await upsertEntities(entities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(`Failed to upsert pages: ${error.message}`);
          } else {
            result.created += entities.length;
          }
        }

        // Check pagination
        hasMore = response.has_more;
        cursor = response.next_cursor ?? undefined;

        // Check limit
        if (options.limit && seenIds.size >= options.limit) {
          hasMore = false;
          break;
        }
      }
    }

    // Detect deleted pages during full sync (only if not incremental)
    if (!since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.page,
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
    logger.error('sync', `Page sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// User Sync
// =============================================================================

/**
 * Sync users from Notion
 * Note: Users don't have webhooks or incremental sync support
 */
export async function syncUsers(
  client: NotionClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor: string | undefined;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const response = await client.listUsers(cursor, pageSize);

      const entities: UpsertEntityData[] = [];
      for (const user of response.results) {
        seenIds.add(user.id);
        const entity = normalizeUser(user, appConfig);
        entities.push(toUpsertData(entity));

        // Check limit
        if (options.limit && seenIds.size >= options.limit) {
          break;
        }
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

      // Check pagination
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;

      // Check limit
      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deleted users during full sync
    if (!options.since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            NOTION_COLLECTION_KEYS.user,
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
    logger.error('sync', `User sync failed: ${message}`);
  }

  return result;
}
