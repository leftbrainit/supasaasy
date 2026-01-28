/**
 * Connector Conformance Test Suite
 *
 * Validates that any connector implementation conforms to the interface specification.
 * This suite tests:
 * - Metadata requirements (name, version, apiVersion, resources)
 * - Webhook handler interface (verify, parse, extract)
 * - Sync handler interface (fullSync, incrementalSync where supported)
 * - Entity normalization requirements (externalId, collectionKey, rawPayload)
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import type { AppConfig, NormalizedEntity, ParsedWebhookEvent } from '../../types/index.ts';
import type { Connector, IncrementalConnector } from '../index.ts';
import { supportsIncrementalSync } from '../index.ts';
import { createMockAppConfig, createMockRequest } from './mocks/index.ts';

// =============================================================================
// Conformance Test Suite
// =============================================================================

/**
 * Options for running conformance tests
 */
export interface ConformanceTestOptions {
  /** The connector instance to test */
  connector: Connector;
  /** App config to use for tests (will be created if not provided) */
  appConfig?: AppConfig;
  /** Mock webhook payload for webhook tests */
  mockWebhookPayload?: unknown;
  /** Mock raw entity data for normalization tests */
  mockRawEntityData?: Record<string, unknown>;
  /** Resource type to use for normalization tests */
  resourceType?: string;
  /** Skip webhook tests if connector needs special handling */
  skipWebhookTests?: boolean;
  /** Skip sync tests if connector needs special handling */
  skipSyncTests?: boolean;
}

/**
 * Run the full conformance test suite against a connector
 */
export function testConnectorConformance(options: ConformanceTestOptions): void {
  const { connector, skipWebhookTests = false, skipSyncTests = false } = options;
  const appConfig = options.appConfig ??
    createMockAppConfig({ connector: connector.metadata.name });

  // Get a resource type for testing
  const resourceType = options.resourceType ??
    connector.metadata.supportedResources[0]?.resourceType;

  // Get mock data
  const mockRawEntityData = options.mockRawEntityData ?? {
    id: 'test_123',
    name: 'Test Entity',
    created: Math.floor(Date.now() / 1000),
  };

  // =============================================================================
  // Metadata Tests
  // =============================================================================

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - has valid name`, () => {
    assertExists(connector.metadata.name);
    assertEquals(typeof connector.metadata.name, 'string');
    assertEquals(connector.metadata.name.length > 0, true, 'name should not be empty');
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - has valid displayName`, () => {
    assertExists(connector.metadata.displayName);
    assertEquals(typeof connector.metadata.displayName, 'string');
    assertEquals(
      connector.metadata.displayName.length > 0,
      true,
      'displayName should not be empty',
    );
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - has valid version`, () => {
    assertExists(connector.metadata.version);
    assertEquals(typeof connector.metadata.version, 'string');
    // Basic semver-like pattern check
    assertEquals(
      /^\d+\.\d+\.\d+/.test(connector.metadata.version),
      true,
      'version should follow semver pattern',
    );
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - has valid apiVersion`, () => {
    assertExists(connector.metadata.apiVersion);
    assertEquals(typeof connector.metadata.apiVersion, 'string');
    assertEquals(
      connector.metadata.apiVersion.length > 0,
      true,
      'apiVersion should not be empty',
    );
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - has supported resources`, () => {
    assertExists(connector.metadata.supportedResources);
    assertEquals(Array.isArray(connector.metadata.supportedResources), true);
    assertEquals(
      connector.metadata.supportedResources.length > 0,
      true,
      'should have at least one supported resource',
    );
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Metadata - supported resources have required fields`, () => {
    for (const resource of connector.metadata.supportedResources) {
      assertExists(resource.resourceType, 'resource should have resourceType');
      assertExists(resource.collectionKey, 'resource should have collectionKey');
      assertEquals(typeof resource.supportsIncrementalSync, 'boolean');
      assertEquals(typeof resource.supportsWebhooks, 'boolean');
    }
  });

  // =============================================================================
  // Webhook Interface Tests
  // =============================================================================

  if (!skipWebhookTests) {
    Deno.test(`[${connector.metadata.name}] Conformance: Webhook - verifyWebhook returns valid structure`, async () => {
      // Create a mock request
      const request = createMockRequest({
        method: 'POST',
        body: JSON.stringify(options.mockWebhookPayload ?? {}),
      });

      const result = await connector.verifyWebhook(request, appConfig);

      assertExists(result);
      assertEquals(typeof result.valid, 'boolean');
      if (!result.valid) {
        assertEquals(typeof result.reason, 'string');
      }
    });

    Deno.test(`[${connector.metadata.name}] Conformance: Webhook - parseWebhookEvent returns valid event structure`, async () => {
      // Skip if no mock payload provided
      if (!options.mockWebhookPayload) {
        return;
      }

      const event = await connector.parseWebhookEvent(options.mockWebhookPayload, appConfig);

      assertExists(event);
      assertExists(event.eventType);
      assertEquals(
        ['create', 'update', 'delete', 'archive'].includes(event.eventType),
        true,
        `eventType should be valid, got: ${event.eventType}`,
      );
      assertExists(event.originalEventType);
      assertExists(event.resourceType);
      assertExists(event.externalId);
      assertExists(event.data);
      assertInstanceOf(event.timestamp, Date);
    });

    Deno.test(`[${connector.metadata.name}] Conformance: Webhook - extractEntity returns valid entity or null`, async () => {
      // Skip if no mock payload provided
      if (!options.mockWebhookPayload) {
        return;
      }

      const event = await connector.parseWebhookEvent(options.mockWebhookPayload, appConfig);
      const entity = await connector.extractEntity(event, appConfig);

      // extractEntity can return null for delete events or unsupported resources
      if (entity !== null) {
        assertValidNormalizedEntity(entity);
      }
    });
  }

  // =============================================================================
  // Sync Interface Tests
  // =============================================================================

  if (!skipSyncTests) {
    Deno.test(`[${connector.metadata.name}] Conformance: Sync - fullSync is a function`, () => {
      assertExists(connector.fullSync);
      assertEquals(typeof connector.fullSync, 'function');
    });

    Deno.test(`[${connector.metadata.name}] Conformance: Sync - incrementalSync support detection`, () => {
      const hasIncremental = supportsIncrementalSync(connector);
      assertEquals(typeof hasIncremental, 'boolean');

      if (hasIncremental) {
        const incrementalConnector = connector as IncrementalConnector;
        assertExists(incrementalConnector.incrementalSync);
        assertEquals(typeof incrementalConnector.incrementalSync, 'function');
      }
    });
  }

  // =============================================================================
  // Normalization Tests
  // =============================================================================

  Deno.test(`[${connector.metadata.name}] Conformance: Normalization - normalizeEntity is a function`, () => {
    assertExists(connector.normalizeEntity);
    assertEquals(typeof connector.normalizeEntity, 'function');
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Normalization - produces valid NormalizedEntity`, () => {
    if (!resourceType) {
      return; // Skip if no resource type available
    }

    const entity = connector.normalizeEntity(resourceType, mockRawEntityData, appConfig);
    assertValidNormalizedEntity(entity);
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Normalization - entity has correct appKey`, () => {
    if (!resourceType) {
      return;
    }

    const entity = connector.normalizeEntity(resourceType, mockRawEntityData, appConfig);
    assertEquals(entity.appKey, appConfig.app_key);
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Normalization - entity has valid collectionKey`, () => {
    if (!resourceType) {
      return;
    }

    const entity = connector.normalizeEntity(resourceType, mockRawEntityData, appConfig);
    assertExists(entity.collectionKey);
    assertEquals(entity.collectionKey.length > 0, true);
  });

  Deno.test(`[${connector.metadata.name}] Conformance: Normalization - rawPayload contains original data`, () => {
    if (!resourceType) {
      return;
    }

    const entity = connector.normalizeEntity(resourceType, mockRawEntityData, appConfig);
    assertExists(entity.rawPayload);
    assertEquals(typeof entity.rawPayload, 'object');
  });
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Assert that an entity is a valid NormalizedEntity
 */
export function assertValidNormalizedEntity(entity: NormalizedEntity): void {
  assertExists(entity, 'entity should not be null/undefined');
  assertExists(entity.externalId, 'entity should have externalId');
  assertEquals(typeof entity.externalId, 'string', 'externalId should be a string');
  assertEquals(entity.externalId.length > 0, true, 'externalId should not be empty');

  assertExists(entity.appKey, 'entity should have appKey');
  assertEquals(typeof entity.appKey, 'string', 'appKey should be a string');

  assertExists(entity.collectionKey, 'entity should have collectionKey');
  assertEquals(typeof entity.collectionKey, 'string', 'collectionKey should be a string');

  assertExists(entity.rawPayload, 'entity should have rawPayload');
  assertEquals(typeof entity.rawPayload, 'object', 'rawPayload should be an object');

  // apiVersion is optional but if present should be a string
  if (entity.apiVersion !== undefined) {
    assertEquals(typeof entity.apiVersion, 'string', 'apiVersion should be a string if present');
  }

  // archivedAt is optional but if present should be a Date
  if (entity.archivedAt !== undefined) {
    assertInstanceOf(entity.archivedAt, Date, 'archivedAt should be a Date if present');
  }
}

/**
 * Assert that a parsed event is valid
 */
export function assertValidParsedEvent(event: ParsedWebhookEvent): void {
  assertExists(event, 'event should not be null/undefined');
  assertExists(event.eventType, 'event should have eventType');
  assertEquals(
    ['create', 'update', 'delete', 'archive'].includes(event.eventType),
    true,
    `eventType should be valid, got: ${event.eventType}`,
  );
  assertExists(event.originalEventType, 'event should have originalEventType');
  assertExists(event.resourceType, 'event should have resourceType');
  assertExists(event.externalId, 'event should have externalId');
  assertExists(event.data, 'event should have data');
  assertInstanceOf(event.timestamp, Date, 'timestamp should be a Date');
}
