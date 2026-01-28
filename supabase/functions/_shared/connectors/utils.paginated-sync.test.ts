/**
 * Paginated Sync Utility Tests
 *
 * Tests for the generic paginated sync utility.
 */

import { assertEquals, assertExists } from '@std/assert';
import type { NormalizedEntity } from '../types/index.ts';
import {
  type PaginatedSyncConfig,
  paginatedSync,
  type SyncProgress,
} from './utils.ts';

// =============================================================================
// Test Helpers
// =============================================================================

interface MockItem {
  id: string;
  name: string;
}

function createMockConfig(
  overrides: Partial<PaginatedSyncConfig<MockItem>> = {},
): PaginatedSyncConfig<MockItem> {
  return {
    connectorName: 'test',
    resourceType: 'item',
    collectionKey: 'test_item',
    appKey: 'test_app',
    listPage: async () => ({ data: [], hasMore: false }),
    getId: (item) => item.id,
    normalize: (item) => ({
      externalId: item.id,
      appKey: 'test_app',
      collectionKey: 'test_item',
      rawPayload: item as unknown as Record<string, unknown>,
    }),
    upsertBatch: async () => ({}),
    deleteEntity: async () => ({}),
    ...overrides,
  };
}

function createMockItems(count: number, startId = 1): MockItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item_${startId + i}`,
    name: `Item ${startId + i}`,
  }));
}

// =============================================================================
// Pagination Tests
// =============================================================================

Deno.test('paginatedSync - handles empty response', async () => {
  const config = createMockConfig({
    listPage: async () => ({ data: [], hasMore: false }),
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.created, 0);
  assertEquals(result.deleted, 0);
  assertEquals(result.errors, 0);
});

Deno.test('paginatedSync - processes single page', async () => {
  const items = createMockItems(5);
  const upsertedEntities: NormalizedEntity[] = [];

  const config = createMockConfig({
    listPage: async () => ({ data: items, hasMore: false }),
    upsertBatch: async (entities) => {
      upsertedEntities.push(...entities);
      return {};
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.created, 5);
  assertEquals(upsertedEntities.length, 5);
  assertEquals(upsertedEntities[0].externalId, 'item_1');
});

Deno.test('paginatedSync - handles multiple pages', async () => {
  const page1 = createMockItems(3, 1);
  const page2 = createMockItems(3, 4);
  const page3 = createMockItems(2, 7);
  let pageNumber = 0;

  const config = createMockConfig({
    listPage: async (cursor) => {
      pageNumber++;
      if (pageNumber === 1) {
        return { data: page1, hasMore: true, nextCursor: 'cursor_1' };
      } else if (pageNumber === 2) {
        assertEquals(cursor, 'cursor_1');
        return { data: page2, hasMore: true, nextCursor: 'cursor_2' };
      } else {
        assertEquals(cursor, 'cursor_2');
        return { data: page3, hasMore: false };
      }
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.created, 8);
  assertEquals(pageNumber, 3);
});

Deno.test('paginatedSync - respects limit option', async () => {
  const allItems = createMockItems(100);
  let fetchedCount = 0;

  const config = createMockConfig({
    limit: 25,
    listPage: async () => {
      // Return 10 items per page
      const start = fetchedCount;
      const pageItems = allItems.slice(start, start + 10);
      fetchedCount += pageItems.length;
      return { data: pageItems, hasMore: fetchedCount < 100 };
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  // Should stop after reaching limit (around 30 due to page boundaries)
  assertEquals(result.created <= 30, true);
  assertEquals(result.created >= 25, true);
});

// =============================================================================
// Deletion Detection Tests
// =============================================================================

Deno.test('paginatedSync - detects deletions during full sync', async () => {
  const existingIds = new Set(['item_1', 'item_2', 'item_3', 'item_deleted']);
  const currentItems = createMockItems(3); // Only items 1-3 exist now
  const deletedIds: string[] = [];

  const config = createMockConfig({
    existingIds,
    listPage: async () => ({ data: currentItems, hasMore: false }),
    deleteEntity: async (id) => {
      deletedIds.push(id);
      return {};
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.created, 3);
  assertEquals(result.deleted, 1);
  assertEquals(deletedIds.includes('item_deleted'), true);
});

Deno.test('paginatedSync - skips deletion when existingIds not provided', async () => {
  const currentItems = createMockItems(2);
  let deleteWasCalled = false;

  const config = createMockConfig({
    // No existingIds provided
    listPage: async () => ({ data: currentItems, hasMore: false }),
    deleteEntity: async () => {
      deleteWasCalled = true;
      return {};
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.deleted, 0);
  assertEquals(deleteWasCalled, false);
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test('paginatedSync - handles API error gracefully', async () => {
  const config = createMockConfig({
    listPage: async () => {
      throw new Error('API connection failed');
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, false);
  assertEquals(result.errors, 1);
  assertExists(result.errorMessages);
  assertEquals(result.errorMessages![0].includes('API connection failed'), true);
});

Deno.test('paginatedSync - handles upsert error', async () => {
  const items = createMockItems(3);

  const config = createMockConfig({
    listPage: async () => ({ data: items, hasMore: false }),
    upsertBatch: async () => ({ error: new Error('Database write failed') }),
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true); // Continues despite error
  assertEquals(result.errors, 1);
  assertExists(result.errorMessages);
  assertEquals(result.errorMessages![0].includes('Database write failed'), true);
});

Deno.test('paginatedSync - handles delete error', async () => {
  const existingIds = new Set(['item_1', 'item_deleted']);
  const currentItems = createMockItems(1);

  const config = createMockConfig({
    existingIds,
    listPage: async () => ({ data: currentItems, hasMore: false }),
    deleteEntity: async () => ({ error: new Error('Delete failed') }),
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.errors, 1);
  assertEquals(result.deleted, 0);
});

// =============================================================================
// Dry Run Tests
// =============================================================================

Deno.test('paginatedSync - dry run skips database writes', async () => {
  const items = createMockItems(3);
  let upsertWasCalled = false;
  let deleteWasCalled = false;
  const existingIds = new Set(['item_1', 'item_2', 'item_3', 'item_deleted']);

  const config = createMockConfig({
    dryRun: true,
    existingIds,
    listPage: async () => ({ data: items, hasMore: false }),
    upsertBatch: async () => {
      upsertWasCalled = true;
      return {};
    },
    deleteEntity: async () => {
      deleteWasCalled = true;
      return {};
    },
  });

  const result = await paginatedSync(config);

  assertEquals(result.success, true);
  assertEquals(result.created, 3); // Counts what would be created
  assertEquals(result.deleted, 1); // Counts what would be deleted
  assertEquals(upsertWasCalled, false); // But doesn't actually call
  assertEquals(deleteWasCalled, false);
});

// =============================================================================
// Progress Callback Tests
// =============================================================================

Deno.test('paginatedSync - calls progress callback', async () => {
  const page1 = createMockItems(5, 1);
  const page2 = createMockItems(5, 6);
  const progressUpdates: SyncProgress[] = [];
  let pageNum = 0;

  const config = createMockConfig({
    listPage: async () => {
      pageNum++;
      if (pageNum === 1) {
        return { data: page1, hasMore: true, nextCursor: 'c1' };
      }
      return { data: page2, hasMore: false };
    },
    onProgress: (progress) => {
      progressUpdates.push({ ...progress });
    },
  });

  await paginatedSync(config);

  assertEquals(progressUpdates.length, 2);
  assertEquals(progressUpdates[0].fetched, 5);
  assertEquals(progressUpdates[0].page, 1);
  assertEquals(progressUpdates[1].fetched, 10);
  assertEquals(progressUpdates[1].page, 2);
});

// =============================================================================
// Timing Tests
// =============================================================================

Deno.test('paginatedSync - includes duration in result', async () => {
  const config = createMockConfig({
    listPage: async () => {
      // Small delay to ensure measurable duration
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { data: [], hasMore: false };
    },
  });

  const result = await paginatedSync(config);

  assertExists(result.durationMs);
  assertEquals(result.durationMs! >= 10, true);
});
