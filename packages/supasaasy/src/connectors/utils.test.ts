/**
 * Connector Utilities Unit Tests
 *
 * Tests for utility functions:
 * - Entity normalization helpers
 * - Sync result helpers
 * - Collection key builders
 * - Archive detection
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import {
  buildCollectionKey,
  createConnectorLogger,
  createNormalizedEntity,
  createTimer,
  detectArchivedAt,
  emptySyncResult,
  entityToRow,
  extractExternalId,
  failedSyncResult,
  getCollectionKey,
  mergeSyncResults,
  rowToEntity,
} from './utils.ts';
import type { EntityRow, NormalizedEntity, SupportedResource, SyncResult } from '../types/index.ts';

// =============================================================================
// Entity Conversion Tests
// =============================================================================

Deno.test('[Utils] entityToRow - converts NormalizedEntity to EntityRow', () => {
  const entity: NormalizedEntity = {
    externalId: 'ext_123',
    appKey: 'test_app',
    collectionKey: 'test_collection',
    apiVersion: '2024-01-01',
    rawPayload: { id: 'ext_123', name: 'Test' },
    archivedAt: new Date('2024-06-01T00:00:00Z'),
  };

  const row = entityToRow(entity);

  assertEquals(row.external_id, 'ext_123');
  assertEquals(row.app_key, 'test_app');
  assertEquals(row.collection_key, 'test_collection');
  assertEquals(row.api_version, '2024-01-01');
  assertEquals(row.raw_payload.name, 'Test');
  assertEquals(row.archived_at, '2024-06-01T00:00:00.000Z');
});

Deno.test('[Utils] entityToRow - handles undefined archivedAt', () => {
  const entity: NormalizedEntity = {
    externalId: 'ext_123',
    appKey: 'test_app',
    collectionKey: 'test_collection',
    rawPayload: { id: 'ext_123' },
  };

  const row = entityToRow(entity);

  assertEquals(row.archived_at, null);
});

Deno.test('[Utils] rowToEntity - converts EntityRow to NormalizedEntity', () => {
  const row: EntityRow = {
    id: 'uuid_123',
    external_id: 'ext_456',
    app_key: 'test_app',
    collection_key: 'test_collection',
    api_version: '2024-01-01',
    raw_payload: { id: 'ext_456', data: 'value' },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    archived_at: '2024-03-01T00:00:00Z',
    deleted_at: null,
  };

  const entity = rowToEntity(row);

  assertEquals(entity.externalId, 'ext_456');
  assertEquals(entity.appKey, 'test_app');
  assertEquals(entity.collectionKey, 'test_collection');
  assertEquals(entity.apiVersion, '2024-01-01');
  assertEquals(entity.rawPayload.data, 'value');
  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Utils] rowToEntity - handles null archivedAt', () => {
  const row: EntityRow = {
    external_id: 'ext_789',
    app_key: 'test_app',
    collection_key: 'test_collection',
    raw_payload: { id: 'ext_789' },
    archived_at: null,
  };

  const entity = rowToEntity(row);

  assertEquals(entity.archivedAt, undefined);
});

// =============================================================================
// createNormalizedEntity Tests
// =============================================================================

Deno.test('[Utils] createNormalizedEntity - creates entity with all fields', () => {
  const entity = createNormalizedEntity({
    externalId: 'ext_create',
    appKey: 'app_create',
    collectionKey: 'collection_create',
    rawPayload: { test: 'data' },
    apiVersion: '1.0.0',
    archivedAt: new Date(),
  });

  assertEquals(entity.externalId, 'ext_create');
  assertEquals(entity.appKey, 'app_create');
  assertEquals(entity.collectionKey, 'collection_create');
  assertEquals(entity.rawPayload.test, 'data');
  assertEquals(entity.apiVersion, '1.0.0');
  assertExists(entity.archivedAt);
});

Deno.test('[Utils] createNormalizedEntity - creates entity with minimal fields', () => {
  const entity = createNormalizedEntity({
    externalId: 'ext_minimal',
    appKey: 'app_minimal',
    collectionKey: 'collection_minimal',
    rawPayload: {},
  });

  assertEquals(entity.externalId, 'ext_minimal');
  assertEquals(entity.apiVersion, undefined);
  assertEquals(entity.archivedAt, undefined);
});

// =============================================================================
// Collection Key Tests
// =============================================================================

Deno.test('[Utils] buildCollectionKey - combines provider and resource type', () => {
  assertEquals(buildCollectionKey('stripe', 'customer'), 'stripe_customer');
  assertEquals(buildCollectionKey('shopify', 'order'), 'shopify_order');
  assertEquals(buildCollectionKey('intercom', 'conversation'), 'intercom_conversation');
});

Deno.test('[Utils] getCollectionKey - finds collection key from resources', () => {
  const resources: SupportedResource[] = [
    {
      resourceType: 'customer',
      collectionKey: 'stripe_customer',
      supportsIncrementalSync: true,
      supportsWebhooks: true,
    },
    {
      resourceType: 'product',
      collectionKey: 'stripe_product',
      supportsIncrementalSync: true,
      supportsWebhooks: true,
    },
  ];

  assertEquals(getCollectionKey(resources, 'customer'), 'stripe_customer');
  assertEquals(getCollectionKey(resources, 'product'), 'stripe_product');
});

Deno.test('[Utils] getCollectionKey - returns undefined for unknown resource', () => {
  const resources: SupportedResource[] = [
    {
      resourceType: 'customer',
      collectionKey: 'stripe_customer',
      supportsIncrementalSync: true,
      supportsWebhooks: true,
    },
  ];

  assertEquals(getCollectionKey(resources, 'unknown'), undefined);
});

// =============================================================================
// Archive Detection Tests
// =============================================================================

Deno.test('[Utils] detectArchivedAt - detects archived: true', () => {
  const data = { id: '123', archived: true };
  const result = detectArchivedAt(data);
  assertExists(result);
  assertInstanceOf(result, Date);
});

Deno.test('[Utils] detectArchivedAt - detects deleted: true', () => {
  const data = { id: '123', deleted: true };
  const result = detectArchivedAt(data);
  assertExists(result);
});

Deno.test('[Utils] detectArchivedAt - detects is_archived: true', () => {
  const data = { id: '123', is_archived: true };
  const result = detectArchivedAt(data);
  assertExists(result);
});

Deno.test('[Utils] detectArchivedAt - uses archived_at timestamp when available', () => {
  const timestamp = '2024-06-01T12:00:00Z';
  const data = { id: '123', archived: true, archived_at: timestamp };
  const result = detectArchivedAt(data);
  assertExists(result);
  assertEquals(result!.toISOString(), new Date(timestamp).toISOString());
});

Deno.test('[Utils] detectArchivedAt - detects status: archived', () => {
  const data = { id: '123', status: 'archived' };
  const result = detectArchivedAt(data);
  assertExists(result);
});

Deno.test('[Utils] detectArchivedAt - detects status: cancelled', () => {
  const data = { id: '123', status: 'cancelled' };
  const result = detectArchivedAt(data);
  assertExists(result);
});

Deno.test('[Utils] detectArchivedAt - returns undefined for active entity', () => {
  const data = { id: '123', status: 'active', archived: false };
  const result = detectArchivedAt(data);
  assertEquals(result, undefined);
});

// =============================================================================
// External ID Extraction Tests
// =============================================================================

Deno.test('[Utils] extractExternalId - extracts id field', () => {
  assertEquals(extractExternalId({ id: 'test_123' }), 'test_123');
});

Deno.test('[Utils] extractExternalId - extracts external_id field', () => {
  assertEquals(extractExternalId({ external_id: 'ext_456' }), 'ext_456');
});

Deno.test('[Utils] extractExternalId - extracts uid field', () => {
  assertEquals(extractExternalId({ uid: 'uid_789' }), 'uid_789');
});

Deno.test('[Utils] extractExternalId - extracts numeric id as string', () => {
  assertEquals(extractExternalId({ id: 12345 }), '12345');
});

Deno.test('[Utils] extractExternalId - prefers id over other fields', () => {
  assertEquals(
    extractExternalId({ id: 'preferred', external_id: 'not_this', uid: 'or_this' }),
    'preferred',
  );
});

Deno.test('[Utils] extractExternalId - returns undefined when no id found', () => {
  assertEquals(extractExternalId({ name: 'no_id_here' }), undefined);
});

// =============================================================================
// Sync Result Tests
// =============================================================================

Deno.test('[Utils] emptySyncResult - returns clean result', () => {
  const result = emptySyncResult();

  assertEquals(result.success, true);
  assertEquals(result.created, 0);
  assertEquals(result.updated, 0);
  assertEquals(result.deleted, 0);
  assertEquals(result.errors, 0);
});

Deno.test('[Utils] failedSyncResult - returns failed result with message', () => {
  const result = failedSyncResult('Something went wrong');

  assertEquals(result.success, false);
  assertEquals(result.errors, 1);
  assertExists(result.errorMessages);
  assertEquals(result.errorMessages!.length, 1);
  assertEquals(result.errorMessages![0], 'Something went wrong');
});

Deno.test('[Utils] mergeSyncResults - combines multiple results', () => {
  const results: SyncResult[] = [
    { success: true, created: 5, updated: 3, deleted: 1, errors: 0 },
    { success: true, created: 2, updated: 1, deleted: 0, errors: 0 },
    { success: true, created: 0, updated: 0, deleted: 2, errors: 0 },
  ];

  const merged = mergeSyncResults(results);

  assertEquals(merged.success, true);
  assertEquals(merged.created, 7);
  assertEquals(merged.updated, 4);
  assertEquals(merged.deleted, 3);
  assertEquals(merged.errors, 0);
});

Deno.test('[Utils] mergeSyncResults - sets success to false if any failed', () => {
  const results: SyncResult[] = [
    { success: true, created: 5, updated: 0, deleted: 0, errors: 0 },
    { success: false, created: 0, updated: 0, deleted: 0, errors: 1, errorMessages: ['Error 1'] },
    { success: true, created: 2, updated: 0, deleted: 0, errors: 0 },
  ];

  const merged = mergeSyncResults(results);

  assertEquals(merged.success, false);
  assertEquals(merged.errors, 1);
  assertExists(merged.errorMessages);
  assertEquals(merged.errorMessages!.includes('Error 1'), true);
});

Deno.test('[Utils] mergeSyncResults - preserves last cursor', () => {
  const results: SyncResult[] = [
    { success: true, created: 0, updated: 0, deleted: 0, errors: 0, nextCursor: 'cursor_1' },
    { success: true, created: 0, updated: 0, deleted: 0, errors: 0, nextCursor: 'cursor_2' },
  ];

  const merged = mergeSyncResults(results);

  assertEquals(merged.nextCursor, 'cursor_2');
});

Deno.test('[Utils] mergeSyncResults - preserves hasMore flag', () => {
  const results: SyncResult[] = [
    { success: true, created: 0, updated: 0, deleted: 0, errors: 0, hasMore: false },
    { success: true, created: 0, updated: 0, deleted: 0, errors: 0, hasMore: true },
  ];

  const merged = mergeSyncResults(results);

  assertEquals(merged.hasMore, true);
});

Deno.test('[Utils] mergeSyncResults - handles empty array', () => {
  const merged = mergeSyncResults([]);

  assertEquals(merged.success, true);
  assertEquals(merged.created, 0);
  assertEquals(merged.updated, 0);
  assertEquals(merged.deleted, 0);
  assertEquals(merged.errors, 0);
});

// =============================================================================
// Logger Tests
// =============================================================================

Deno.test('[Utils] createConnectorLogger - creates logger with methods', () => {
  const logger = createConnectorLogger('test_connector');

  assertEquals(typeof logger.debug, 'function');
  assertEquals(typeof logger.info, 'function');
  assertEquals(typeof logger.warn, 'function');
  assertEquals(typeof logger.error, 'function');
  assertEquals(typeof logger.webhookReceived, 'function');
  assertEquals(typeof logger.webhookProcessed, 'function');
  assertEquals(typeof logger.syncStarted, 'function');
  assertEquals(typeof logger.syncCompleted, 'function');
  assertEquals(typeof logger.syncFailed, 'function');
});

Deno.test('[Utils] createConnectorLogger - log methods return LogEntry', () => {
  const logger = createConnectorLogger('test_connector');

  const entry = logger.info('test_operation', 'Test message', { key: 'value' });

  assertExists(entry);
  assertEquals(entry.level, 'info');
  assertEquals(entry.connector, 'test_connector');
  assertEquals(entry.operation, 'test_operation');
  assertEquals(entry.message, 'Test message');
  assertExists(entry.timestamp);
  assertExists(entry.data);
  assertEquals(entry.data!.key, 'value');
});

// =============================================================================
// Timer Tests
// =============================================================================

Deno.test('[Utils] createTimer - returns elapsed time', async () => {
  const timer = createTimer();

  // Wait a small amount
  await new Promise((resolve) => setTimeout(resolve, 10));

  const elapsed = timer.elapsed();

  // Should be at least 10ms (with some tolerance)
  assertEquals(elapsed >= 5, true);
  assertEquals(typeof elapsed, 'number');
});

Deno.test('[Utils] createTimer - elapsed increases over time', async () => {
  const timer = createTimer();

  const elapsed1 = timer.elapsed();
  await new Promise((resolve) => setTimeout(resolve, 5));
  const elapsed2 = timer.elapsed();

  assertEquals(elapsed2 >= elapsed1, true);
});
