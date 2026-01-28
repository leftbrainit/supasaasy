/**
 * Intercom Connector Unit Tests
 */

import { assertEquals, assertExists } from '@std/assert';
import {
  computeTestSignature,
  createMockAdmin,
  createMockCompany,
  createMockContact,
  createMockConversation,
  createMockConversationPart,
  createMockIntercomAppConfig,
  createMockWebhookPayload,
} from './mocks.ts';
import {
  assertValidNormalizedEntity,
  testConnectorConformance,
} from '../../__tests__/conformance.test.ts';
import intercomConnector from '../index.ts';
import { INTERCOM_COLLECTION_KEYS } from '../types.ts';
import { detectArchivedAt } from '../normalization.ts';
import { verifyWebhook, parseWebhookEvent } from '../webhooks.ts';

// =============================================================================
// Test Helpers
// =============================================================================

const mockAppConfig = createMockIntercomAppConfig();

// =============================================================================
// Conformance Suite
// =============================================================================

testConnectorConformance({
  connector: intercomConnector,
  appConfig: mockAppConfig,
  mockWebhookPayload: createMockWebhookPayload({
    topic: 'contact.created',
    item: createMockContact({ id: 'test_123' }) as unknown as Record<string, unknown>,
  }),
  mockRawEntityData: createMockContact({ id: 'test_123' }) as unknown as Record<string, unknown>,
  resourceType: 'contact',
  // Skip webhook tests that need real signature verification
  skipWebhookTests: true,
  // Skip sync tests that need real API
  skipSyncTests: true,
});

// =============================================================================
// Metadata Tests
// =============================================================================

Deno.test('[Intercom] Metadata - has correct name', () => {
  assertEquals(intercomConnector.metadata.name, 'intercom');
});

Deno.test('[Intercom] Metadata - has correct displayName', () => {
  assertEquals(intercomConnector.metadata.displayName, 'Intercom');
});

Deno.test('[Intercom] Metadata - supports expected resources', () => {
  const resourceTypes = intercomConnector.metadata.supportedResources.map((r) => r.resourceType);
  assertEquals(resourceTypes.includes('company'), true);
  assertEquals(resourceTypes.includes('contact'), true);
  assertEquals(resourceTypes.includes('admin'), true);
  assertEquals(resourceTypes.includes('conversation'), true);
  assertEquals(resourceTypes.includes('conversation_part'), true);
});

Deno.test('[Intercom] Metadata - admin does not support webhooks', () => {
  const adminResource = intercomConnector.metadata.supportedResources.find(
    (r) => r.resourceType === 'admin',
  );
  assertExists(adminResource);
  assertEquals(adminResource.supportsWebhooks, false);
});

Deno.test('[Intercom] Metadata - conversation supports incremental sync', () => {
  const conversationResource = intercomConnector.metadata.supportedResources.find(
    (r) => r.resourceType === 'conversation',
  );
  assertExists(conversationResource);
  assertEquals(conversationResource.supportsIncrementalSync, true);
});

// =============================================================================
// Normalization Tests
// =============================================================================

Deno.test('[Intercom] Normalize - company entity', () => {
  const companyData = createMockCompany({
    id: 'company_123',
    name: 'Test Company Inc',
    industry: 'Technology',
  });

  const entity = intercomConnector.normalizeEntity(
    'company',
    companyData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'company_123');
  assertEquals(entity.appKey, mockAppConfig.app_key);
  assertEquals(entity.collectionKey, INTERCOM_COLLECTION_KEYS.company);
  assertEquals(entity.apiVersion, '2.14');
});

Deno.test('[Intercom] Normalize - contact entity', () => {
  const contactData = createMockContact({
    id: 'contact_123',
    email: 'test@example.com',
    name: 'Test User',
  });

  const entity = intercomConnector.normalizeEntity(
    'contact',
    contactData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'contact_123');
  assertEquals(entity.appKey, mockAppConfig.app_key);
  assertEquals(entity.collectionKey, INTERCOM_COLLECTION_KEYS.contact);
});

Deno.test('[Intercom] Normalize - admin entity', () => {
  const adminData = createMockAdmin({
    id: 'admin_123',
    email: 'admin@example.com',
    name: 'Admin User',
  });

  const entity = intercomConnector.normalizeEntity(
    'admin',
    adminData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'admin_123');
  assertEquals(entity.collectionKey, INTERCOM_COLLECTION_KEYS.admin);
});

Deno.test('[Intercom] Normalize - conversation entity', () => {
  const conversationData = createMockConversation({
    id: 'conv_123',
    state: 'open',
  });

  const entity = intercomConnector.normalizeEntity(
    'conversation',
    conversationData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'conv_123');
  assertEquals(entity.collectionKey, INTERCOM_COLLECTION_KEYS.conversation);
  assertEquals(entity.archivedAt, undefined); // Open conversation should not be archived
});

Deno.test('[Intercom] Normalize - closed conversation is archived', () => {
  const conversationData = createMockConversation({
    id: 'conv_closed',
    state: 'closed',
    open: false,
  });

  const entity = intercomConnector.normalizeEntity(
    'conversation',
    conversationData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertExists(entity.archivedAt); // Closed conversation should be archived
});

Deno.test('[Intercom] Normalize - conversation part entity', () => {
  const partData = createMockConversationPart({
    id: 'part_123',
    conversation_id: 'conv_456',
    part_type: 'comment',
    body: 'Test message',
  });

  const entity = intercomConnector.normalizeEntity(
    'conversation_part',
    partData as unknown as Record<string, unknown>,
    mockAppConfig,
  );

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'part_123');
  assertEquals(entity.collectionKey, INTERCOM_COLLECTION_KEYS.conversation_part);
});

// =============================================================================
// Archived State Detection Tests
// =============================================================================

Deno.test('[Intercom] detectArchivedAt - open conversation returns undefined', () => {
  const data = { state: 'open', updated_at: 1234567890 };
  const result = detectArchivedAt('conversation', data);
  assertEquals(result, undefined);
});

Deno.test('[Intercom] detectArchivedAt - closed conversation returns date', () => {
  const data = { state: 'closed', updated_at: 1234567890 };
  const result = detectArchivedAt('conversation', data);
  assertExists(result);
  assertEquals(result instanceof Date, true);
});

Deno.test('[Intercom] detectArchivedAt - snoozed conversation returns undefined', () => {
  const data = { state: 'snoozed', updated_at: 1234567890 };
  const result = detectArchivedAt('conversation', data);
  assertEquals(result, undefined);
});

Deno.test('[Intercom] detectArchivedAt - contact returns undefined by default', () => {
  const data = { id: 'contact_123', email: 'test@example.com' };
  const result = detectArchivedAt('contact', data);
  assertEquals(result, undefined);
});

// =============================================================================
// Webhook Verification Tests
// =============================================================================

Deno.test('[Intercom] Webhook - verifyWebhook accepts valid signature', async () => {
  const webhookSecret = 'test_secret_123';
  const config = createMockIntercomAppConfig({ webhookSecret });

  const payload = createMockWebhookPayload({
    topic: 'contact.created',
    item: createMockContact() as unknown as Record<string, unknown>,
  });
  const body = JSON.stringify(payload);
  const signature = await computeTestSignature(webhookSecret, body);

  const request = new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature': signature,
    },
    body,
  });

  const result = await verifyWebhook(request, config);
  assertEquals(result.valid, true);
  assertExists(result.payload);
});

Deno.test('[Intercom] Webhook - verifyWebhook rejects invalid signature', async () => {
  const config = createMockIntercomAppConfig({ webhookSecret: 'correct_secret' });

  const payload = createMockWebhookPayload({
    topic: 'contact.created',
    item: createMockContact() as unknown as Record<string, unknown>,
  });
  const body = JSON.stringify(payload);
  const wrongSignature = await computeTestSignature('wrong_secret', body);

  const request = new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature': wrongSignature,
    },
    body,
  });

  const result = await verifyWebhook(request, config);
  assertEquals(result.valid, false);
  assertExists(result.reason);
});

Deno.test('[Intercom] Webhook - verifyWebhook rejects missing signature', async () => {
  const config = createMockIntercomAppConfig();

  const request = new Request('https://example.com/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const result = await verifyWebhook(request, config);
  assertEquals(result.valid, false);
  assertEquals(result.reason, 'Missing X-Hub-Signature header');
});

// =============================================================================
// Webhook Parsing Tests
// =============================================================================

Deno.test('[Intercom] Webhook - parseWebhookEvent parses contact.created', async () => {
  const contact = createMockContact({ id: 'contact_123' });
  const payload = createMockWebhookPayload({
    topic: 'contact.created',
    item: contact as unknown as Record<string, unknown>,
  });

  const event = await parseWebhookEvent(payload, mockAppConfig);

  assertEquals(event.eventType, 'create');
  assertEquals(event.originalEventType, 'contact.created');
  assertEquals(event.resourceType, 'contact');
  assertEquals(event.externalId, 'contact_123');
});

Deno.test('[Intercom] Webhook - parseWebhookEvent parses conversation.admin.closed', async () => {
  const conversation = createMockConversation({ id: 'conv_123', state: 'closed' });
  const payload = createMockWebhookPayload({
    topic: 'conversation.admin.closed',
    item: conversation as unknown as Record<string, unknown>,
  });

  const event = await parseWebhookEvent(payload, mockAppConfig);

  assertEquals(event.eventType, 'update');
  assertEquals(event.originalEventType, 'conversation.admin.closed');
  assertEquals(event.resourceType, 'conversation');
  assertEquals(event.externalId, 'conv_123');
});

Deno.test('[Intercom] Webhook - parseWebhookEvent handles unknown topic', async () => {
  const payload = createMockWebhookPayload({
    topic: 'unknown.event.type',
    item: { id: 'test_123' },
  });

  const event = await parseWebhookEvent(payload, mockAppConfig);

  assertEquals(event.eventType, 'update'); // Defaults to update
  assertEquals(event.resourceType, 'unknown');
});

// =============================================================================
// Validation Tests
// =============================================================================

Deno.test('[Intercom] Validation - has validateConfig method', () => {
  assertExists(intercomConnector.validateConfig);
  assertEquals(typeof intercomConnector.validateConfig, 'function');
});

Deno.test('[Intercom] Validation - valid config passes validation', () => {
  Deno.env.set('TEST_INTERCOM_API_KEY', 'test_key_123');

  const config = createMockIntercomAppConfig({
    apiKeyEnv: 'TEST_INTERCOM_API_KEY',
  });

  const result = intercomConnector.validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);

  Deno.env.delete('TEST_INTERCOM_API_KEY');
});

Deno.test('[Intercom] Validation - missing API key fails validation', () => {
  const config = createMockIntercomAppConfig({
    apiKey: undefined,
    apiKeyEnv: 'NONEXISTENT_ENV_VAR',
  });

  // Clear any default env vars that might exist
  Deno.env.delete('INTERCOM_API_KEY_INTERCOM_TEST');

  const result = intercomConnector.validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
  assertEquals(result.errors[0].field, 'api_key');
});

Deno.test('[Intercom] Validation - invalid sync_from date fails validation', () => {
  const config = createMockIntercomAppConfig({
    syncFrom: 'not-a-valid-date',
  });

  const result = intercomConnector.validateConfig(config);

  assertEquals(result.valid, false);
  const syncFromError = result.errors.find((e) => e.field === 'sync_from');
  assertExists(syncFromError);
});

Deno.test('[Intercom] Validation - invalid resource type fails validation', () => {
  const config = createMockIntercomAppConfig({
    syncResources: ['invalid_resource' as never],
  });

  const result = intercomConnector.validateConfig(config);

  assertEquals(result.valid, false);
  const resourceError = result.errors.find((e) => e.field === 'sync_resources');
  assertExists(resourceError);
});
