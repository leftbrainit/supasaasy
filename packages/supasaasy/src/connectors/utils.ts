/**
 * Connector Utilities
 *
 * Helper functions for entity normalization, logging, and common operations.
 */

import type { EntityRow, NormalizedEntity, SupportedResource, SyncResult } from '../types/index.ts';

// =============================================================================
// Entity Normalization Helpers
// =============================================================================

/**
 * Convert a NormalizedEntity to a database row format
 * @param entity The normalized entity
 * @returns Database row ready for insertion
 */
export function entityToRow(entity: NormalizedEntity): EntityRow {
  return {
    external_id: entity.externalId,
    app_key: entity.appKey,
    collection_key: entity.collectionKey,
    api_version: entity.apiVersion,
    raw_payload: entity.rawPayload,
    archived_at: entity.archivedAt?.toISOString() ?? null,
  };
}

/**
 * Convert a database row to a NormalizedEntity
 * @param row The database row
 * @returns Normalized entity
 */
export function rowToEntity(row: EntityRow): NormalizedEntity {
  return {
    externalId: row.external_id,
    appKey: row.app_key,
    collectionKey: row.collection_key,
    apiVersion: row.api_version,
    rawPayload: row.raw_payload,
    archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
  };
}

/**
 * Create a NormalizedEntity from raw API data
 * @param params Entity creation parameters
 * @returns Normalized entity
 */
export function createNormalizedEntity(params: {
  externalId: string;
  appKey: string;
  collectionKey: string;
  rawPayload: Record<string, unknown>;
  apiVersion?: string;
  archivedAt?: Date;
}): NormalizedEntity {
  return {
    externalId: params.externalId,
    appKey: params.appKey,
    collectionKey: params.collectionKey,
    rawPayload: params.rawPayload,
    apiVersion: params.apiVersion,
    archivedAt: params.archivedAt,
  };
}

/**
 * Build the collection_key for an entity
 * @param providerName The connector/provider name (e.g., 'stripe')
 * @param resourceType The resource type (e.g., 'customer')
 * @returns Collection key (e.g., 'stripe_customer')
 */
export function buildCollectionKey(
  providerName: string,
  resourceType: string,
): string {
  return `${providerName}_${resourceType}`;
}

/**
 * Get the collection_key from supported resources
 * @param resources List of supported resources
 * @param resourceType The resource type to look up
 * @returns The collection_key or undefined if not found
 */
export function getCollectionKey(
  resources: SupportedResource[],
  resourceType: string,
): string | undefined {
  const resource = resources.find((r) => r.resourceType === resourceType);
  return resource?.collectionKey;
}

/**
 * Detect if an entity is archived based on common SaaS patterns
 * @param data Raw API response data
 * @returns Date if archived, undefined otherwise
 */
export function detectArchivedAt(
  data: Record<string, unknown>,
): Date | undefined {
  // Check common archived/deleted/inactive fields
  const archivedFields = [
    'archived',
    'deleted',
    'is_archived',
    'is_deleted',
    'trashed',
    'is_trashed',
  ];

  for (const field of archivedFields) {
    if (data[field] === true) {
      // Try to get a timestamp if available
      const timestampFields = [
        'archived_at',
        'deleted_at',
        'trashed_at',
        `${field}_at`,
      ];
      for (const tsField of timestampFields) {
        const ts = data[tsField];
        if (typeof ts === 'string' || typeof ts === 'number') {
          return new Date(ts);
        }
      }
      // No timestamp found, use current time
      return new Date();
    }
  }

  // Check status fields
  const status = data['status'] || data['state'];
  if (
    typeof status === 'string' &&
    ['archived', 'deleted', 'trashed', 'inactive', 'cancelled'].includes(
      status.toLowerCase(),
    )
  ) {
    return new Date();
  }

  return undefined;
}

/**
 * Extract the external ID from common SaaS response patterns
 * @param data Raw API response data
 * @returns The external ID or undefined if not found
 */
export function extractExternalId(
  data: Record<string, unknown>,
): string | undefined {
  // Check common ID field names
  const idFields = ['id', 'external_id', 'uid', 'uuid', '_id'];

  for (const field of idFields) {
    const value = data[field];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }

  return undefined;
}

// =============================================================================
// Sync Result Helpers
// =============================================================================

/**
 * Create an empty sync result
 */
export function emptySyncResult(): SyncResult {
  return {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
  };
}

/**
 * Create a failed sync result
 * @param errorMessage The error message
 */
export function failedSyncResult(errorMessage: string): SyncResult {
  return {
    success: false,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 1,
    errorMessages: [errorMessage],
  };
}

/**
 * Merge multiple sync results into one
 * @param results Array of sync results to merge
 * @returns Combined sync result
 */
export function mergeSyncResults(results: SyncResult[]): SyncResult {
  const merged: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: 0,
    errorMessages: [],
  };

  for (const result of results) {
    merged.created += result.created;
    merged.updated += result.updated;
    merged.deleted += result.deleted;
    merged.errors += result.errors;

    if (!result.success) {
      merged.success = false;
    }

    if (result.errorMessages) {
      merged.errorMessages = [
        ...(merged.errorMessages || []),
        ...result.errorMessages,
      ];
    }

    // Keep the last cursor/hasMore for pagination
    if (result.nextCursor !== undefined) {
      merged.nextCursor = result.nextCursor;
    }
    if (result.hasMore !== undefined) {
      merged.hasMore = result.hasMore;
    }
  }

  // Clean up empty error messages array
  if (merged.errorMessages?.length === 0) {
    delete merged.errorMessages;
  }

  return merged;
}

// =============================================================================
// Paginated Sync Utility
// =============================================================================

/**
 * Progress information for sync operations
 */
export interface SyncProgressInfo {
  /** The resource type being synced */
  resourceType: string;
  /** The collection key being synced */
  collectionKey: string;
  /** Number of items fetched so far */
  fetched: number;
  /** Total number of items if known */
  total?: number;
  /** Current page number */
  page: number;
}

/**
 * Paginated response structure from an API
 */
export interface PaginatedResponse<T> {
  /** The items in this page */
  data: T[];
  /** Whether there are more pages */
  hasMore: boolean;
  /** Cursor for next page if applicable */
  nextCursor?: string;
}

/**
 * Configuration for paginated sync operations
 */
export interface PaginatedSyncConfig<T> {
  /** Name of the connector (for logging) */
  connectorName: string;
  /** Resource type being synced */
  resourceType: string;
  /** Collection key for the database */
  collectionKey: string;
  /** App key for the database */
  appKey: string;

  /** Function to list a page of items from the API */
  listPage: (cursor?: string) => Promise<PaginatedResponse<T>>;

  /** Function to get the ID from an item */
  getId: (item: T) => string;

  /** Function to normalize an item to a NormalizedEntity */
  normalize: (item: T) => NormalizedEntity;

  /** Function to upsert entities to the database */
  upsertBatch: (entities: NormalizedEntity[]) => Promise<{ error?: Error }>;

  /** Function to delete an entity from the database */
  deleteEntity: (externalId: string) => Promise<{ error?: Error }>;

  /** Page size for API requests */
  pageSize?: number;

  /** Maximum total records to sync */
  limit?: number;

  /** Starting cursor for pagination */
  cursor?: string;

  /** Existing IDs for deletion detection (full sync only) */
  existingIds?: Set<string>;

  /** Progress callback */
  onProgress?: (progress: SyncProgressInfo) => void;

  /** Dry run mode - don't write to database */
  dryRun?: boolean;

  /** Verbose logging mode */
  verbose?: boolean;

  /** Logger instance */
  logger?: ReturnType<typeof createConnectorLogger>;
}

/**
 * Generic paginated sync utility for any API with cursor-based pagination.
 *
 * Handles:
 * - Cursor-based pagination loop
 * - Timer tracking and result aggregation
 * - Error handling with consistent error messages
 * - Deletion detection for full syncs
 * - Batch upserts to database
 * - Progress callbacks
 * - Dry-run mode
 *
 * @param config Configuration for the sync operation
 * @returns SyncResult with counts and timing
 */
export async function paginatedSync<T>(
  config: PaginatedSyncConfig<T>,
): Promise<SyncResult> {
  const result = emptySyncResult();
  const timer = createTimer();
  const seenIds = new Set<string>();
  let cursor = config.cursor;
  let page = 0;

  const log = config.logger ?? createConnectorLogger(config.connectorName);

  try {
    let hasMore = true;

    while (hasMore) {
      page++;

      // Fetch a page from the API
      const response = await config.listPage(cursor);

      // Process items in this page
      const entities: NormalizedEntity[] = [];

      for (const item of response.data) {
        const id = config.getId(item);
        seenIds.add(id);

        const entity = config.normalize(item);
        entities.push(entity);

        if (config.verbose) {
          log.debug(
            'sync',
            `Processing ${config.resourceType} ${id}`,
            { externalId: id, collectionKey: config.collectionKey },
          );
        }
      }

      // Upsert batch (unless dry-run)
      if (entities.length > 0) {
        if (config.dryRun) {
          log.info(
            'sync',
            `[DRY-RUN] Would upsert ${entities.length} ${config.resourceType}(s)`,
            { count: entities.length, ids: entities.map((e) => e.externalId) },
          );
          result.created += entities.length;
        } else {
          const { error } = await config.upsertBatch(entities);
          if (error) {
            result.errors++;
            result.errorMessages = result.errorMessages || [];
            result.errorMessages.push(error.message);
            log.error('sync', `Failed to upsert ${config.resourceType}(s): ${error.message}`);
          } else {
            result.created += entities.length;
          }
        }
      }

      // Report progress
      if (config.onProgress) {
        config.onProgress({
          resourceType: config.resourceType,
          collectionKey: config.collectionKey,
          fetched: seenIds.size,
          page,
        });
      }

      // Check pagination
      hasMore = response.hasMore;
      cursor = response.nextCursor;

      // Check limit
      if (config.limit && seenIds.size >= config.limit) {
        log.info('sync', `Reached limit of ${config.limit} ${config.resourceType}(s)`);
        break;
      }
    }

    // Detect deletions during full sync
    if (config.existingIds) {
      for (const existingId of config.existingIds) {
        if (!seenIds.has(existingId)) {
          if (config.dryRun) {
            log.info(
              'sync',
              `[DRY-RUN] Would delete ${config.resourceType} ${existingId}`,
              { externalId: existingId },
            );
            result.deleted++;
          } else {
            const { error } = await config.deleteEntity(existingId);
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

    log.info(
      'sync',
      `Completed ${config.resourceType} sync: ${result.created} upserted, ${result.deleted} deleted`,
      { created: result.created, deleted: result.deleted, durationMs: result.durationMs },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors++;
    result.errorMessages = result.errorMessages || [];
    result.errorMessages.push(message);
    log.error('sync', `${config.resourceType} sync failed: ${message}`);
  }

  return result;
}

// =============================================================================
// Logging Utilities
// =============================================================================

/**
 * Log levels for connector operations
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  connector: string;
  operation: string;
  message: string;
  data?: Record<string, unknown>;
}

/** Logger interface returned by createConnectorLogger */
export interface ConnectorLogger {
  debug: (operation: string, message: string, data?: Record<string, unknown>) => LogEntry;
  info: (operation: string, message: string, data?: Record<string, unknown>) => LogEntry;
  warn: (operation: string, message: string, data?: Record<string, unknown>) => LogEntry;
  error: (operation: string, message: string, data?: Record<string, unknown>) => LogEntry;
  webhookReceived: (eventType: string, externalId?: string) => LogEntry;
  webhookProcessed: (eventType: string, externalId: string, success: boolean) => LogEntry;
  syncStarted: (syncType: 'full' | 'incremental', resourceTypes?: string[]) => LogEntry;
  syncCompleted: (result: SyncResult) => LogEntry;
  syncFailed: (error: Error) => LogEntry;
}

/**
 * Create a connector-scoped logger
 * @param connectorName The connector name for log context
 * @returns Logger object with level methods
 */
export function createConnectorLogger(connectorName: string): ConnectorLogger {
  const log = (
    level: LogLevel,
    operation: string,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      connector: connectorName,
      operation,
      message,
      data,
    };

    const formatted =
      `[${entry.timestamp}] [${level.toUpperCase()}] [${connectorName}] ${operation}: ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formatted, data || '');
        break;
      case 'info':
        console.info(formatted, data || '');
        break;
      case 'warn':
        console.warn(formatted, data || '');
        break;
      case 'error':
        console.error(formatted, data || '');
        break;
    }

    return entry;
  };

  return {
    debug: (operation: string, message: string, data?: Record<string, unknown>) =>
      log('debug', operation, message, data),
    info: (operation: string, message: string, data?: Record<string, unknown>) =>
      log('info', operation, message, data),
    warn: (operation: string, message: string, data?: Record<string, unknown>) =>
      log('warn', operation, message, data),
    error: (operation: string, message: string, data?: Record<string, unknown>) =>
      log('error', operation, message, data),

    // Convenience methods for common operations
    webhookReceived: (eventType: string, externalId?: string) =>
      log('info', 'webhook', `Received ${eventType}`, { eventType, externalId }),
    webhookProcessed: (eventType: string, externalId: string, success: boolean) =>
      log('info', 'webhook', `Processed ${eventType}`, { eventType, externalId, success }),
    syncStarted: (syncType: 'full' | 'incremental', resourceTypes?: string[]) =>
      log('info', 'sync', `Started ${syncType} sync`, { syncType, resourceTypes }),
    syncCompleted: (result: SyncResult) =>
      log('info', 'sync', `Sync completed`, {
        success: result.success,
        created: result.created,
        updated: result.updated,
        deleted: result.deleted,
        errors: result.errors,
      }),
    syncFailed: (error: Error) =>
      log('error', 'sync', `Sync failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      }),
  };
}

/**
 * Create a timer for measuring operation duration
 * @returns Object with elapsed() method returning milliseconds
 */
export function createTimer(): { elapsed: () => number } {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
  };
}
