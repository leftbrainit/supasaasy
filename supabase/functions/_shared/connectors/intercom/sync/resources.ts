/**
 * Intercom Resource Sync Functions
 *
 * Individual sync functions for each Intercom resource type.
 */

import type { AppConfig, NormalizedEntity, SyncOptions, SyncResult } from '../../../types/index.ts';
import {
  deleteEntity,
  upsertEntities,
  type UpsertEntityData,
} from '../../../db.ts';
import { createTimer, emptySyncResult } from '../../utils.ts';
import { type IntercomClient, DEFAULT_PAGE_SIZE, logger } from '../client.ts';
import { normalizeIntercomEntity } from '../normalization.ts';
import { INTERCOM_COLLECTION_KEYS } from '../types.ts';

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
// Company Sync
// =============================================================================

/**
 * Sync companies from Intercom
 */
export async function syncCompanies(
  client: IntercomClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor: string | undefined;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const response = await client.listCompanies(cursor, pageSize);

      const entities: UpsertEntityData[] = [];
      for (const company of response.data) {
        // Filter by sync_from if configured (only for full sync)
        if (syncFromTimestamp && !options.since && company.created_at < syncFromTimestamp) {
          continue;
        }

        seenIds.add(company.id);
        const entity = normalizeIntercomEntity(
          'company',
          company as unknown as Record<string, unknown>,
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

      // Check pagination
      hasMore = response.pages?.next?.starting_after !== undefined;
      if (hasMore) {
        cursor = response.pages?.next?.starting_after;
      }

      // Check limit
      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync (only for records in sync window)
    if (!options.since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            INTERCOM_COLLECTION_KEYS.company,
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
    logger.error('sync', `Company sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// Contact Sync
// =============================================================================

/**
 * Sync contacts from Intercom
 */
export async function syncContacts(
  client: IntercomClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor: string | undefined;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();

  try {
    let hasMore = true;
    while (hasMore) {
      const response = await client.listContacts(cursor, pageSize);

      const entities: UpsertEntityData[] = [];
      for (const contact of response.data) {
        // Filter by sync_from if configured (only for full sync)
        if (syncFromTimestamp && !options.since && contact.created_at < syncFromTimestamp) {
          continue;
        }

        seenIds.add(contact.id);
        const entity = normalizeIntercomEntity(
          'contact',
          contact as unknown as Record<string, unknown>,
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

      // Check pagination
      hasMore = response.pages?.next?.starting_after !== undefined;
      if (hasMore) {
        cursor = response.pages?.next?.starting_after;
      }

      // Check limit
      if (options.limit && seenIds.size >= options.limit) {
        break;
      }
    }

    // Detect deletions during full sync
    if (!options.since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            INTERCOM_COLLECTION_KEYS.contact,
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
    logger.error('sync', `Contact sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// Admin Sync
// =============================================================================

/**
 * Sync admins from Intercom
 * Note: Admins don't have webhooks and the list endpoint doesn't support pagination
 */
export async function syncAdmins(
  client: IntercomClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  const seenIds = new Set<string>();

  try {
    const response = await client.listAdmins();

    const entities: UpsertEntityData[] = [];
    for (const admin of response.admins) {
      seenIds.add(admin.id);
      const entity = normalizeIntercomEntity(
        'admin',
        admin as unknown as Record<string, unknown>,
        appConfig,
      );
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

    // Detect deletions during full sync
    if (!options.since && existingIds) {
      for (const existingId of existingIds) {
        if (!seenIds.has(existingId)) {
          const { error } = await deleteEntity(
            appConfig.app_key,
            INTERCOM_COLLECTION_KEYS.admin,
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
    logger.error('sync', `Admin sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// Conversation Sync
// =============================================================================

/**
 * Sync conversations from Intercom (also syncs conversation parts)
 */
export async function syncConversations(
  client: IntercomClient,
  appConfig: AppConfig,
  options: SyncOptions,
  existingIds?: Set<string>,
  existingPartIds?: Set<string>,
  syncFromTimestamp?: number,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  let cursor: string | undefined;
  const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
  const seenIds = new Set<string>();
  const seenPartIds = new Set<string>();
  const since = options.since;

  try {
    let hasMore = true;

    // For incremental sync, use the search endpoint
    if (since) {
      const sinceTimestamp = Math.floor(since.getTime() / 1000);

      while (hasMore) {
        const response = await client.searchConversations(sinceTimestamp, cursor, pageSize);

        const convEntities: UpsertEntityData[] = [];
        const partEntities: UpsertEntityData[] = [];

        for (const conversation of response.conversations) {
          seenIds.add(conversation.id);

          // Fetch full conversation with parts
          const fullConversation = await client.getConversation(conversation.id);

          const convEntity = normalizeIntercomEntity(
            'conversation',
            fullConversation as unknown as Record<string, unknown>,
            appConfig,
          );
          convEntities.push(toUpsertData(convEntity));

          // Extract conversation parts
          const parts = fullConversation.conversation_parts?.conversation_parts;
          if (parts && Array.isArray(parts)) {
            for (const part of parts) {
              seenPartIds.add(part.id);
              const partData = {
                ...part,
                conversation_id: conversation.id,
              };
              const partEntity = normalizeIntercomEntity(
                'conversation_part',
                partData as Record<string, unknown>,
                appConfig,
              );
              partEntities.push(toUpsertData(partEntity));
            }
          }
        }

        // Upsert conversations
        if (convEntities.length > 0) {
          const { error } = await upsertEntities(convEntities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(`Failed to upsert conversations: ${error.message}`);
          } else {
            result.created += convEntities.length;
          }
        }

        // Upsert conversation parts
        if (partEntities.length > 0) {
          const { error } = await upsertEntities(partEntities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(`Failed to upsert conversation parts: ${error.message}`);
          } else {
            result.created += partEntities.length;
            logger.info('sync', `Synced ${partEntities.length} conversation part(s)`);
          }
        }

        // Check pagination - conversations search uses page-based pagination
        const currentPage = response.pages?.page ?? 1;
        const totalPages = response.pages?.total_pages ?? 1;
        hasMore = currentPage < totalPages;
        // Note: For now, we only sync the first page due to API limitations
        if (hasMore) {
          hasMore = false;
          logger.warn('sync', 'Intercom conversation search pagination limited to first page');
        }

        // Check limit
        if (options.limit && seenIds.size >= options.limit) {
          break;
        }
      }
    } else {
      // Full sync using list endpoint
      while (hasMore) {
        const response = await client.listConversations(cursor, pageSize);

        const convEntities: UpsertEntityData[] = [];
        const partEntities: UpsertEntityData[] = [];

        for (const conversation of response.conversations) {
          // Filter by sync_from if configured
          if (syncFromTimestamp && conversation.created_at < syncFromTimestamp) {
            continue;
          }

          seenIds.add(conversation.id);

          // Fetch full conversation with parts
          const fullConversation = await client.getConversation(conversation.id);

          const convEntity = normalizeIntercomEntity(
            'conversation',
            fullConversation as unknown as Record<string, unknown>,
            appConfig,
          );
          convEntities.push(toUpsertData(convEntity));

          // Extract conversation parts
          const parts = fullConversation.conversation_parts?.conversation_parts;
          if (parts && Array.isArray(parts)) {
            logger.info('sync', `Conversation ${conversation.id} has ${parts.length} part(s)`);
            for (const part of parts) {
              seenPartIds.add(part.id);
              const partData = {
                ...part,
                conversation_id: conversation.id,
              };
              const partEntity = normalizeIntercomEntity(
                'conversation_part',
                partData as Record<string, unknown>,
                appConfig,
              );
              partEntities.push(toUpsertData(partEntity));
            }
          }
        }

        // Upsert conversations
        if (convEntities.length > 0) {
          const { error } = await upsertEntities(convEntities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(`Failed to upsert conversations: ${error.message}`);
          } else {
            result.created += convEntities.length;
          }
        }

        // Upsert conversation parts
        if (partEntities.length > 0) {
          const { error } = await upsertEntities(partEntities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(`Failed to upsert conversation parts: ${error.message}`);
          } else {
            result.created += partEntities.length;
            logger.info('sync', `Synced ${partEntities.length} conversation part(s)`);
          }
        }

        // Check pagination - conversations uses page-based pagination
        const currentPage = response.pages?.page ?? 1;
        const totalPages = response.pages?.total_pages ?? 1;
        hasMore = currentPage < totalPages;
        // Note: Intercom conversation list doesn't support cursor-based pagination
        // For now, we only sync the first page. For full pagination, we'd need to
        // use page numbers, but the API may have limitations.
        if (hasMore) {
          // Intercom conversations API doesn't support starting_after for list
          // We can only get one page for now
          hasMore = false;
          logger.warn('sync', 'Intercom conversations pagination limited to first page');
        }

        // Check limit
        if (options.limit && seenIds.size >= options.limit) {
          break;
        }
      }

      // Detect deleted conversations during full sync
      if (existingIds) {
        for (const existingId of existingIds) {
          if (!seenIds.has(existingId)) {
            const { error } = await deleteEntity(
              appConfig.app_key,
              INTERCOM_COLLECTION_KEYS.conversation,
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

      // Detect deleted conversation parts during full sync
      if (existingPartIds) {
        for (const existingId of existingPartIds) {
          if (!seenPartIds.has(existingId)) {
            const { error } = await deleteEntity(
              appConfig.app_key,
              INTERCOM_COLLECTION_KEYS.conversation_part,
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
    }

    result.durationMs = timer.elapsed();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = [message];
    logger.error('sync', `Conversation sync failed: ${message}`);
  }

  return result;
}
