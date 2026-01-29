/**
 * Notion Connector Unit Tests
 *
 * Tests for the Notion connector implementation covering:
 * - Webhook signature verification
 * - Webhook event parsing
 * - Entity normalization
 * - archived_at detection
 * - Notion UUID as entity ID
 * - Property extraction
 * - Conformance suite
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import {
  createMockBotUser,
  createMockDataSource,
  createMockDataSourceCreatedEvent,
  createMockDataSourceDeletedEvent,
  createMockDataSourceUpdatedEvent,
  createMockNotionAppConfig,
  createMockPage,
  createMockPageCreatedEvent,
  createMockPageDeletedEvent,
  createMockPageUpdatedEvent,
  createMockUser,
  createMockWebhookPayload,
} from './mocks.ts';
import {
  assertValidNormalizedEntity,
  testConnectorConformance,
} from '../../__tests__/conformance.test.ts';
import { createMockRequest } from '../../__tests__/mocks/index.ts';
import { notionConnector } from '../index.ts';
import { extractDataSourceProperties } from '../normalization.ts';
import { NOTION_COLLECTION_KEYS } from '../types.ts';

// =============================================================================
// Test Helpers
// =============================================================================

const mockAppConfig = createMockNotionAppConfig();

// =============================================================================
// Conformance Suite
// =============================================================================

// Run the conformance test suite against the Notion connector
testConnectorConformance({
  connector: notionConnector,
  appConfig: mockAppConfig,
  mockWebhookPayload: createMockDataSourceCreatedEvent({ id: 'test-uuid-1234' }),
  mockRawEntityData: createMockDataSource({ id: 'test-uuid-1234' }) as unknown as Record<
    string,
    unknown
  >,
  resourceType: 'data_source',
  // Skip webhook tests that need real Notion signature verification
  skipWebhookTests: true,
  // Skip sync tests that need real Notion API
  skipSyncTests: true,
});

// =============================================================================
// Metadata Tests
// =============================================================================

Deno.test('[Notion] Metadata - has correct name', () => {
  assertEquals(notionConnector.metadata.name, 'notion');
});

Deno.test('[Notion] Metadata - has correct displayName', () => {
  assertEquals(notionConnector.metadata.displayName, 'Notion');
});

Deno.test('[Notion] Metadata - has correct API version', () => {
  assertEquals(notionConnector.metadata.apiVersion, '2025-09-03');
});

Deno.test('[Notion] Metadata - supports expected resources', () => {
  const resourceTypes = notionConnector.metadata.supportedResources.map((r) => r.resourceType);
  assertEquals(resourceTypes.includes('data_source'), true);
  assertEquals(resourceTypes.includes('data_source_property'), true);
  assertEquals(resourceTypes.includes('page'), true);
  assertEquals(resourceTypes.includes('user'), true);
});

Deno.test('[Notion] Metadata - has migrations defined', () => {
  assertExists(notionConnector.metadata.migrations);
  assertEquals(Array.isArray(notionConnector.metadata.migrations), true);
  assertEquals(notionConnector.metadata.migrations!.length > 0, true);
});

Deno.test('[Notion] Metadata - user resource does not support webhooks', () => {
  const userResource = notionConnector.metadata.supportedResources.find(
    (r) => r.resourceType === 'user',
  );
  assertExists(userResource);
  assertEquals(userResource.supportsWebhooks, false);
});

Deno.test('[Notion] Metadata - page resource supports incremental sync', () => {
  const pageResource = notionConnector.metadata.supportedResources.find(
    (r) => r.resourceType === 'page',
  );
  assertExists(pageResource);
  assertEquals(pageResource.supportsIncrementalSync, true);
});

// =============================================================================
// Webhook Verification Tests
// =============================================================================

Deno.test('[Notion] Webhook - rejects request without signature header', async () => {
  const request = createMockRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(createMockDataSourceCreatedEvent()),
  });

  const result = await notionConnector.verifyWebhook(request, mockAppConfig);

  assertEquals(result.valid, false);
  assertExists(result.reason);
  assertEquals(result.reason!.includes('Missing'), true);
});

Deno.test('[Notion] Webhook - rejects request with invalid signature', async () => {
  const request = createMockRequest({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-notion-signature': 'invalid_signature',
    },
    body: JSON.stringify(createMockDataSourceCreatedEvent()),
  });

  const result = await notionConnector.verifyWebhook(request, mockAppConfig);

  assertEquals(result.valid, false);
  assertExists(result.reason);
});

// =============================================================================
// Webhook Event Parsing Tests
// =============================================================================

Deno.test('[Notion] Webhook Parse - data_source.created event', async () => {
  const mockEvent = createMockDataSourceCreatedEvent({ id: 'ds-123' });

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.originalEventType, 'data_source.created');
  assertEquals(parsed.resourceType, 'data_source');
  assertEquals(parsed.externalId, 'ds-123');
  assertExists(parsed.data);
  assertInstanceOf(parsed.timestamp, Date);
});

Deno.test('[Notion] Webhook Parse - data_source.schema_updated event', async () => {
  const mockEvent = createMockDataSourceUpdatedEvent({ id: 'ds-456' });

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.originalEventType, 'data_source.schema_updated');
  assertEquals(parsed.resourceType, 'data_source');
  assertEquals(parsed.externalId, 'ds-456');
});

Deno.test('[Notion] Webhook Parse - data_source.deleted event', async () => {
  const mockEvent = createMockDataSourceDeletedEvent('ds-789');

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'delete');
  assertEquals(parsed.originalEventType, 'data_source.deleted');
  assertEquals(parsed.resourceType, 'data_source');
  assertEquals(parsed.externalId, 'ds-789');
});

Deno.test('[Notion] Webhook Parse - page.created event', async () => {
  const mockEvent = createMockPageCreatedEvent({ id: 'page-123' });

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.originalEventType, 'page.created');
  assertEquals(parsed.resourceType, 'page');
  assertEquals(parsed.externalId, 'page-123');
});

Deno.test('[Notion] Webhook Parse - page.properties_updated event', async () => {
  const mockEvent = createMockPageUpdatedEvent({ id: 'page-456' });

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.originalEventType, 'page.properties_updated');
  assertEquals(parsed.resourceType, 'page');
});

Deno.test('[Notion] Webhook Parse - page.deleted event', async () => {
  const mockEvent = createMockPageDeletedEvent('page-789');

  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'delete');
  assertEquals(parsed.originalEventType, 'page.deleted');
  assertEquals(parsed.resourceType, 'page');
  assertEquals(parsed.externalId, 'page-789');
});

Deno.test('[Notion] Webhook Parse - unknown event type returns update', async () => {
  const mockUnknownEvent = createMockWebhookPayload({ type: 'unknown.event.type' });

  const parsed = await notionConnector.parseWebhookEvent(mockUnknownEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.resourceType, 'unknown');
});

// =============================================================================
// Entity Extraction Tests
// =============================================================================

Deno.test('[Notion] Extract Entity - data source created', async () => {
  const mockEvent = createMockDataSourceCreatedEvent({ id: 'ds-extract-123' });
  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);
  const entity = await notionConnector.extractEntity(parsed, mockAppConfig);

  assertExists(entity);
  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'ds-extract-123');
  assertEquals(entity.collectionKey, NOTION_COLLECTION_KEYS.data_source);
});

Deno.test('[Notion] Extract Entity - data source deleted returns null', async () => {
  const mockEvent = createMockDataSourceDeletedEvent('ds-delete-123');
  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);
  const entity = await notionConnector.extractEntity(parsed, mockAppConfig);

  assertEquals(entity, null);
});

Deno.test('[Notion] Extract Entities - data source extracts properties', async () => {
  const mockEvent = createMockDataSourceCreatedEvent({ id: 'ds-with-props' });
  const parsed = await notionConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  if (!notionConnector.extractEntities) {
    return;
  }

  const entities = await notionConnector.extractEntities(parsed, mockAppConfig);

  // Should have data source + 2 properties (Name and Status from mock)
  assertEquals(entities.length >= 3, true);

  // First entity should be the data source
  assertEquals(entities[0].externalId, 'ds-with-props');
  assertEquals(entities[0].collectionKey, NOTION_COLLECTION_KEYS.data_source);

  // Remaining should be properties
  const propertyEntities = entities.filter(
    (e) => e.collectionKey === NOTION_COLLECTION_KEYS.data_source_property,
  );
  assertEquals(propertyEntities.length >= 2, true);

  // Property external_id should be composite key
  for (const prop of propertyEntities) {
    assertEquals(prop.externalId.includes(':'), true);
  }
});

// =============================================================================
// Entity Normalization Tests
// =============================================================================

Deno.test('[Notion] Normalize - data source entity uses Notion UUID as id and externalId', () => {
  const dataSourceData = createMockDataSource({ id: '2f26ee68-df30-4251-aad4-8ddc420cba3d' });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  // Notion UUID should be used as both id and externalId per spec
  assertEquals(entity.id, '2f26ee68-df30-4251-aad4-8ddc420cba3d');
  assertEquals(entity.externalId, '2f26ee68-df30-4251-aad4-8ddc420cba3d');
  assertEquals(entity.collectionKey, NOTION_COLLECTION_KEYS.data_source);
});

Deno.test('[Notion] Normalize - page entity uses Notion UUID as id and externalId', () => {
  const pageData = createMockPage({ id: '3f37ff79-ef41-5362-bbe5-9eec531d5db4' });

  const entity = notionConnector.normalizeEntity(
    'page',
    pageData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  // Notion UUID should be used as both id and externalId per spec
  assertEquals(entity.id, '3f37ff79-ef41-5362-bbe5-9eec531d5db4');
  assertEquals(entity.externalId, '3f37ff79-ef41-5362-bbe5-9eec531d5db4');
  assertEquals(entity.collectionKey, NOTION_COLLECTION_KEYS.page);
});

Deno.test('[Notion] Normalize - user entity uses Notion UUID as id and externalId', () => {
  const userData = createMockUser({ id: '4g48gg80-fg52-6473-ccf6-0ffd642e6ed5' });

  const entity = notionConnector.normalizeEntity(
    'user',
    userData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  // Notion UUID should be used as both id and externalId per spec
  assertEquals(entity.id, '4g48gg80-fg52-6473-ccf6-0ffd642e6ed5');
  assertEquals(entity.externalId, '4g48gg80-fg52-6473-ccf6-0ffd642e6ed5');
  assertEquals(entity.collectionKey, NOTION_COLLECTION_KEYS.user);
});

Deno.test('[Notion] Normalize - person user preserves email', () => {
  const userData = createMockUser({
    id: 'user-person',
    name: 'John Doe',
    email: 'john@example.com',
  });

  const entity = notionConnector.normalizeEntity(
    'user',
    userData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertEquals(entity.rawPayload.type, 'person');
  assertEquals((entity.rawPayload.person as { email: string }).email, 'john@example.com');
});

Deno.test('[Notion] Normalize - bot user preserves bot info', () => {
  const botData = createMockBotUser({
    id: 'user-bot',
    name: 'Integration Bot',
  });

  const entity = notionConnector.normalizeEntity(
    'user',
    botData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertEquals(entity.rawPayload.type, 'bot');
  assertExists(entity.rawPayload.bot);
});

// =============================================================================
// Property Extraction Tests
// =============================================================================

Deno.test('[Notion] Properties - extracted from data source', () => {
  const dataSource = createMockDataSource({ id: 'ds-props' });

  const properties = extractDataSourceProperties(dataSource, mockAppConfig);

  assertEquals(properties.length >= 2, true);

  // Each property should have correct collection key
  for (const prop of properties) {
    assertEquals(prop.collectionKey, NOTION_COLLECTION_KEYS.data_source_property);
  }
});

Deno.test('[Notion] Properties - have composite external_id', () => {
  const dataSource = createMockDataSource({ id: 'ds-composite' });

  const properties = extractDataSourceProperties(dataSource, mockAppConfig);

  // Each property external_id should be {data_source_id}:{property_id}
  for (const prop of properties) {
    assertEquals(prop.externalId.startsWith('ds-composite:'), true);
  }
});

Deno.test('[Notion] Properties - use composite external_id and no custom id', () => {
  const dataSource = createMockDataSource({ id: 'ds-gen-id' });

  const properties = extractDataSourceProperties(dataSource, mockAppConfig);

  // Properties use composite external_id format: {data_source_id}:{property_id}
  // and do NOT have a custom id (database generates UUID)
  for (const prop of properties) {
    assertEquals(prop.externalId.startsWith('ds-gen-id:'), true);
    assertEquals(prop.id, undefined); // No custom id for properties
  }
});

Deno.test('[Notion] Properties - rawPayload contains data_source_id', () => {
  const dataSource = createMockDataSource({ id: 'ds-payload' });

  const properties = extractDataSourceProperties(dataSource, mockAppConfig);

  for (const prop of properties) {
    assertEquals(prop.rawPayload.data_source_id, 'ds-payload');
  }
});

// =============================================================================
// Archived At Detection Tests
// =============================================================================

Deno.test('[Notion] ArchivedAt - archived data source has archivedAt', () => {
  const dataSourceData = createMockDataSource({
    id: 'ds-archived',
    archived: true,
  });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Notion] ArchivedAt - in_trash data source has archivedAt', () => {
  const dataSourceData = createMockDataSource({
    id: 'ds-trashed',
    in_trash: true,
  });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Notion] ArchivedAt - active data source has no archivedAt', () => {
  const dataSourceData = createMockDataSource({
    id: 'ds-active',
    archived: false,
    in_trash: false,
  });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Notion] ArchivedAt - archived page has archivedAt', () => {
  const pageData = createMockPage({
    id: 'page-archived',
    archived: true,
  });

  const entity = notionConnector.normalizeEntity(
    'page',
    pageData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Notion] ArchivedAt - in_trash page has archivedAt', () => {
  const pageData = createMockPage({
    id: 'page-trashed',
    in_trash: true,
  });

  const entity = notionConnector.normalizeEntity(
    'page',
    pageData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Notion] ArchivedAt - users never have archivedAt', () => {
  const userData = createMockUser({ id: 'user-active' });

  const entity = notionConnector.normalizeEntity(
    'user',
    userData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertEquals(entity.archivedAt, undefined);
});

// =============================================================================
// Collection Key Tests
// =============================================================================

Deno.test('[Notion] Collection Keys - all resource types have correct keys', () => {
  const resourceTypes = ['data_source', 'page', 'user'] as const;

  const mockData: Record<string, Record<string, unknown>> = {
    data_source: createMockDataSource() as unknown as Record<string, unknown>,
    page: createMockPage() as unknown as Record<string, unknown>,
    user: createMockUser() as unknown as Record<string, unknown>,
  };

  for (const resourceType of resourceTypes) {
    const entity = notionConnector.normalizeEntity(resourceType, mockData[resourceType], mockAppConfig);

    assertEquals(
      entity.collectionKey,
      NOTION_COLLECTION_KEYS[resourceType],
      `${resourceType} should have correct collection key`,
    );
  }
});

// =============================================================================
// API Version Tests
// =============================================================================

Deno.test('[Notion] API Version - entity includes apiVersion', () => {
  const dataSourceData = createMockDataSource({ id: 'ds-api-version' });
  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertExists(entity.apiVersion);
  assertEquals(entity.apiVersion, '2025-09-03');
});

// =============================================================================
// App Key Tests
// =============================================================================

Deno.test('[Notion] App Key - entity uses correct appKey from config', () => {
  const customConfig = createMockNotionAppConfig({ app_key: 'custom_notion_app' });
  const dataSourceData = createMockDataSource({ id: 'ds-app-key' });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    customConfig,
  );

  assertEquals(entity.appKey, 'custom_notion_app');
});

// =============================================================================
// Raw Payload Tests
// =============================================================================

Deno.test('[Notion] Raw Payload - preserves all original data', () => {
  const dataSourceData = createMockDataSource({
    id: 'ds-raw-payload',
    title: 'Raw Payload Test',
  });

  const entity = notionConnector.normalizeEntity(
    'data_source',
    dataSourceData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertEquals(entity.rawPayload.id, 'ds-raw-payload');
  assertEquals(entity.rawPayload.object, 'data_source');
  assertExists(entity.rawPayload.properties);
  assertExists(entity.rawPayload.parent);
});
