/**
 * Connector Utilities
 *
 * Helper functions for entity normalization, logging, and common operations.
 */

import type {
  EntityRow,
  NormalizedEntity,
  SupportedResource,
  SyncResult,
} from '../types/index.ts';

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
  resourceType: string
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
  resourceType: string
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
  data: Record<string, unknown>
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
      status.toLowerCase()
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
  data: Record<string, unknown>
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

/**
 * Create a connector-scoped logger
 * @param connectorName The connector name for log context
 * @returns Logger object with level methods
 */
export function createConnectorLogger(connectorName: string) {
  const log = (
    level: LogLevel,
    operation: string,
    message: string,
    data?: Record<string, unknown>
  ) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      connector: connectorName,
      operation,
      message,
      data,
    };

    const formatted = `[${entry.timestamp}] [${level.toUpperCase()}] [${connectorName}] ${operation}: ${message}`;

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
