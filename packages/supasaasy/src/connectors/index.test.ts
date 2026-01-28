/**
 * Connector Registry Unit Tests
 *
 * Tests for the connector registry functionality:
 * - Connector registration and lookup
 * - getConnectorForAppKey with various configurations
 * - Cache behavior
 * - Listing connectors
 */

import { assertEquals, assertExists } from '@std/assert';
import {
  clearConnectorCache,
  clearConnectorRegistry,
  getConnector,
  type IncrementalConnector,
  listConnectorMetadata,
  listConnectors,
  registerConnector,
  supportsIncrementalSync,
} from './index.ts';
import { createMockConnector, createMockSyncResult } from './__tests__/mocks/index.ts';

// =============================================================================
// Test Setup/Teardown
// =============================================================================

/**
 * Reset registry state before each test group
 */
function resetRegistry(): void {
  clearConnectorRegistry();
}

// =============================================================================
// Registration Tests
// =============================================================================

Deno.test('[Registry] Register - can register a connector', async () => {
  resetRegistry();

  const mockConnector = createMockConnector({
    metadata: { name: 'test_register' },
  });

  registerConnector('test_register', () => mockConnector);

  const retrieved = await getConnector('test_register');
  assertExists(retrieved);
  assertEquals(retrieved.metadata.name, 'test_register');
});

Deno.test('[Registry] Register - can overwrite existing connector', async () => {
  resetRegistry();

  const connector1 = createMockConnector({
    metadata: { name: 'overwrite', version: '1.0.0' },
  });
  const connector2 = createMockConnector({
    metadata: { name: 'overwrite', version: '2.0.0' },
  });

  registerConnector('overwrite', () => connector1);
  registerConnector('overwrite', () => connector2);

  const retrieved = await getConnector('overwrite');
  assertExists(retrieved);
  assertEquals(retrieved.metadata.version, '2.0.0');
});

Deno.test('[Registry] Register - async factory function works', async () => {
  resetRegistry();

  const mockConnector = createMockConnector({
    metadata: { name: 'async_factory' },
  });

  registerConnector('async_factory', async () => {
    // Simulate async initialization
    await new Promise((resolve) => setTimeout(resolve, 1));
    return mockConnector;
  });

  const retrieved = await getConnector('async_factory');
  assertExists(retrieved);
  assertEquals(retrieved.metadata.name, 'async_factory');
});

// =============================================================================
// Lookup Tests
// =============================================================================

Deno.test('[Registry] Lookup - returns undefined for unregistered connector', async () => {
  resetRegistry();

  const retrieved = await getConnector('nonexistent');
  assertEquals(retrieved, undefined);
});

Deno.test('[Registry] Lookup - caches connector after first retrieval', async () => {
  resetRegistry();

  let callCount = 0;
  const mockConnector = createMockConnector({
    metadata: { name: 'cached' },
  });

  registerConnector('cached', () => {
    callCount++;
    return mockConnector;
  });

  // First retrieval
  await getConnector('cached');
  assertEquals(callCount, 1);

  // Second retrieval should use cache
  await getConnector('cached');
  assertEquals(callCount, 1);
});

Deno.test('[Registry] Lookup - cache is cleared on re-registration', async () => {
  resetRegistry();

  let callCount = 0;
  const mockConnector = createMockConnector({
    metadata: { name: 'cache_clear' },
  });

  registerConnector('cache_clear', () => {
    callCount++;
    return mockConnector;
  });

  // First retrieval
  await getConnector('cache_clear');
  assertEquals(callCount, 1);

  // Re-register
  registerConnector('cache_clear', () => {
    callCount++;
    return mockConnector;
  });

  // Should call factory again
  await getConnector('cache_clear');
  assertEquals(callCount, 2);
});

// =============================================================================
// List Tests
// =============================================================================

Deno.test('[Registry] List - returns empty array when no connectors registered', () => {
  resetRegistry();

  const names = listConnectors();
  assertEquals(names.length, 0);
});

Deno.test('[Registry] List - returns all registered connector names', () => {
  resetRegistry();

  registerConnector(
    'list_test_1',
    () => createMockConnector({ metadata: { name: 'list_test_1' } }),
  );
  registerConnector(
    'list_test_2',
    () => createMockConnector({ metadata: { name: 'list_test_2' } }),
  );
  registerConnector(
    'list_test_3',
    () => createMockConnector({ metadata: { name: 'list_test_3' } }),
  );

  const names = listConnectors();
  assertEquals(names.length, 3);
  assertEquals(names.includes('list_test_1'), true);
  assertEquals(names.includes('list_test_2'), true);
  assertEquals(names.includes('list_test_3'), true);
});

Deno.test('[Registry] List Metadata - returns metadata for all connectors', async () => {
  resetRegistry();

  registerConnector('meta_1', () =>
    createMockConnector({
      metadata: { name: 'meta_1', displayName: 'Meta One' },
    }));
  registerConnector('meta_2', () =>
    createMockConnector({
      metadata: { name: 'meta_2', displayName: 'Meta Two' },
    }));

  const metadata = await listConnectorMetadata();
  assertEquals(metadata.length, 2);

  const names = metadata.map((m) => m.name);
  assertEquals(names.includes('meta_1'), true);
  assertEquals(names.includes('meta_2'), true);
});

// =============================================================================
// Clear Tests
// =============================================================================

Deno.test('[Registry] Clear Cache - clears the connector cache', async () => {
  resetRegistry();

  let callCount = 0;
  const mockConnector = createMockConnector({
    metadata: { name: 'clear_cache_test' },
  });

  registerConnector('clear_cache_test', () => {
    callCount++;
    return mockConnector;
  });

  // First retrieval
  await getConnector('clear_cache_test');
  assertEquals(callCount, 1);

  // Clear cache
  clearConnectorCache();

  // Should call factory again
  await getConnector('clear_cache_test');
  assertEquals(callCount, 2);
});

Deno.test('[Registry] Clear Registry - clears both registry and cache', async () => {
  resetRegistry();

  registerConnector('clear_all', () => createMockConnector({ metadata: { name: 'clear_all' } }));

  // Verify registered
  const before = await getConnector('clear_all');
  assertExists(before);

  // Clear everything
  clearConnectorRegistry();

  // Should no longer exist
  const after = await getConnector('clear_all');
  assertEquals(after, undefined);

  // List should be empty
  assertEquals(listConnectors().length, 0);
});

// =============================================================================
// Type Guard Tests
// =============================================================================

Deno.test('[Registry] Type Guard - supportsIncrementalSync returns false for basic connector', () => {
  const basicConnector = createMockConnector();
  assertEquals(supportsIncrementalSync(basicConnector), false);
});

Deno.test('[Registry] Type Guard - supportsIncrementalSync returns true for incremental connector', () => {
  const basicConnector = createMockConnector();

  // Add incrementalSync method to make it an IncrementalConnector
  const incrementalConnector: IncrementalConnector = {
    ...basicConnector,
    // deno-lint-ignore require-await
    async incrementalSync(_config, _since, _options) {
      return createMockSyncResult();
    },
  };

  assertEquals(supportsIncrementalSync(incrementalConnector), true);
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test('[Registry] Edge Case - connector name with special characters', async () => {
  resetRegistry();

  const mockConnector = createMockConnector({
    metadata: { name: 'special-name_123' },
  });

  registerConnector('special-name_123', () => mockConnector);

  const retrieved = await getConnector('special-name_123');
  assertExists(retrieved);
  assertEquals(retrieved.metadata.name, 'special-name_123');
});

Deno.test('[Registry] Edge Case - empty connector name', async () => {
  resetRegistry();

  const mockConnector = createMockConnector({
    metadata: { name: '' },
  });

  registerConnector('', () => mockConnector);

  const retrieved = await getConnector('');
  assertExists(retrieved);
});

Deno.test('[Registry] Edge Case - multiple rapid registrations', async () => {
  resetRegistry();

  // Register many connectors quickly
  for (let i = 0; i < 10; i++) {
    registerConnector(
      `rapid_${i}`,
      () => createMockConnector({ metadata: { name: `rapid_${i}` } }),
    );
  }

  const names = listConnectors();
  assertEquals(names.length, 10);

  // Verify all can be retrieved
  for (let i = 0; i < 10; i++) {
    const connector = await getConnector(`rapid_${i}`);
    assertExists(connector);
  }
});
