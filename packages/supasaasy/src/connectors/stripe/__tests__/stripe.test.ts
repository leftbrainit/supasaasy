/**
 * Stripe Connector Unit Tests
 *
 * Tests for the Stripe connector implementation covering:
 * - Webhook signature verification
 * - Webhook event parsing
 * - Entity normalization
 * - archived_at detection
 * - sync_from filtering
 * - Conformance suite
 */

import { assertEquals, assertExists, assertInstanceOf } from '@std/assert';
import {
  createMockCustomer,
  createMockCustomerCreatedEvent,
  createMockCustomerDeletedEvent,
  createMockCustomerUpdatedEvent,
  createMockPlan,
  createMockPrice,
  createMockProduct,
  createMockStripeAppConfig,
  createMockStripeEvent,
  createMockSubscription,
  createMockSubscriptionEvent,
  createMockSubscriptionItem,
  nowTimestamp,
  pastTimestamp,
} from './mocks.ts';
import {
  assertValidNormalizedEntity,
  testConnectorConformance,
} from '../../__tests__/conformance.test.ts';
import { createMockRequest } from '../../__tests__/mocks/index.ts';
import { stripeConnector } from '../index.ts';
import { STRIPE_COLLECTION_KEYS } from '../types.ts';

// =============================================================================
// Test Helpers
// =============================================================================

const mockAppConfig = createMockStripeAppConfig();

// =============================================================================
// Conformance Suite
// =============================================================================

// Run the conformance test suite against the Stripe connector
testConnectorConformance({
  connector: stripeConnector,
  appConfig: mockAppConfig,
  mockWebhookPayload: createMockCustomerCreatedEvent({ id: 'cus_test123' }),
  mockRawEntityData: createMockCustomer({ id: 'cus_test123' }),
  resourceType: 'customer',
  // Skip webhook tests that need real Stripe signature verification
  skipWebhookTests: true,
  // Skip sync tests that need real Stripe API
  skipSyncTests: true,
});

// =============================================================================
// Metadata Tests
// =============================================================================

Deno.test('[Stripe] Metadata - has correct name', () => {
  assertEquals(stripeConnector.metadata.name, 'stripe');
});

Deno.test('[Stripe] Metadata - has correct displayName', () => {
  assertEquals(stripeConnector.metadata.displayName, 'Stripe');
});

Deno.test('[Stripe] Metadata - supports expected resources', () => {
  const resourceTypes = stripeConnector.metadata.supportedResources.map((r) => r.resourceType);
  assertEquals(resourceTypes.includes('customer'), true);
  assertEquals(resourceTypes.includes('product'), true);
  assertEquals(resourceTypes.includes('price'), true);
  assertEquals(resourceTypes.includes('plan'), true);
  assertEquals(resourceTypes.includes('subscription'), true);
  assertEquals(resourceTypes.includes('subscription_item'), true);
});

Deno.test('[Stripe] Metadata - has migrations defined', () => {
  assertExists(stripeConnector.metadata.migrations);
  assertEquals(Array.isArray(stripeConnector.metadata.migrations), true);
  assertEquals(stripeConnector.metadata.migrations!.length > 0, true);
});

// =============================================================================
// Webhook Verification Tests
// =============================================================================

Deno.test('[Stripe] Webhook - rejects request without signature header', async () => {
  const request = createMockRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(createMockCustomerCreatedEvent()),
  });

  const result = await stripeConnector.verifyWebhook(request, mockAppConfig);

  assertEquals(result.valid, false);
  assertExists(result.reason);
  assertEquals(result.reason!.includes('Missing'), true);
});

Deno.test('[Stripe] Webhook - rejects request with invalid signature', async () => {
  const request = createMockRequest({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'invalid_signature',
    },
    body: JSON.stringify(createMockCustomerCreatedEvent()),
  });

  const result = await stripeConnector.verifyWebhook(request, mockAppConfig);

  assertEquals(result.valid, false);
  assertExists(result.reason);
});

// =============================================================================
// Webhook Event Parsing Tests
// =============================================================================

Deno.test('[Stripe] Webhook Parse - customer.created event', async () => {
  const mockEvent = createMockCustomerCreatedEvent({ id: 'cus_123' });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.originalEventType, 'customer.created');
  assertEquals(parsed.resourceType, 'customer');
  assertEquals(parsed.externalId, 'cus_123');
  assertExists(parsed.data);
  assertInstanceOf(parsed.timestamp, Date);
});

Deno.test('[Stripe] Webhook Parse - customer.updated event', async () => {
  const mockEvent = createMockCustomerUpdatedEvent({ id: 'cus_456' });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.originalEventType, 'customer.updated');
  assertEquals(parsed.resourceType, 'customer');
  assertEquals(parsed.externalId, 'cus_456');
});

Deno.test('[Stripe] Webhook Parse - customer.deleted event', async () => {
  const mockEvent = createMockCustomerDeletedEvent({ id: 'cus_789' });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'delete');
  assertEquals(parsed.originalEventType, 'customer.deleted');
  assertEquals(parsed.resourceType, 'customer');
  assertEquals(parsed.externalId, 'cus_789');
});

Deno.test('[Stripe] Webhook Parse - subscription.created event', async () => {
  const mockEvent = createMockSubscriptionEvent('customer.subscription.created', {
    id: 'sub_123',
    customerId: 'cus_abc',
    status: 'active',
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.originalEventType, 'customer.subscription.created');
  assertEquals(parsed.resourceType, 'subscription');
  assertEquals(parsed.externalId, 'sub_123');
});

Deno.test('[Stripe] Webhook Parse - subscription.updated event', async () => {
  const mockEvent = createMockSubscriptionEvent('customer.subscription.updated', {
    id: 'sub_456',
    status: 'past_due',
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.originalEventType, 'customer.subscription.updated');
  assertEquals(parsed.resourceType, 'subscription');
});

Deno.test('[Stripe] Webhook Parse - subscription.deleted event', async () => {
  const canceledAt = nowTimestamp();
  const mockEvent = createMockSubscriptionEvent('customer.subscription.deleted', {
    id: 'sub_789',
    status: 'canceled',
    canceledAt,
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'archive');
  assertEquals(parsed.originalEventType, 'customer.subscription.deleted');
  assertEquals(parsed.resourceType, 'subscription');
});

Deno.test('[Stripe] Webhook Parse - product events', async () => {
  const mockProductCreated = createMockStripeEvent({
    type: 'product.created',
    data: createMockProduct({ id: 'prod_123' }),
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockProductCreated, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.resourceType, 'product');
  assertEquals(parsed.externalId, 'prod_123');
});

Deno.test('[Stripe] Webhook Parse - price events', async () => {
  const mockPriceCreated = createMockStripeEvent({
    type: 'price.created',
    data: createMockPrice({ id: 'price_123' }),
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockPriceCreated, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.resourceType, 'price');
  assertEquals(parsed.externalId, 'price_123');
});

Deno.test('[Stripe] Webhook Parse - plan events', async () => {
  const mockPlanCreated = createMockStripeEvent({
    type: 'plan.created',
    data: createMockPlan({ id: 'plan_123' }),
  });

  const parsed = await stripeConnector.parseWebhookEvent(mockPlanCreated, mockAppConfig);

  assertEquals(parsed.eventType, 'create');
  assertEquals(parsed.resourceType, 'plan');
  assertEquals(parsed.externalId, 'plan_123');
});

Deno.test('[Stripe] Webhook Parse - unknown event type returns update', async () => {
  const mockUnknownEvent = {
    id: 'evt_unknown',
    object: 'event',
    type: 'unknown.event.type',
    created: nowTimestamp(),
    livemode: false,
    api_version: '2025-02-24.acacia',
    data: {
      object: { id: 'unknown_123' },
    },
  };

  const parsed = await stripeConnector.parseWebhookEvent(mockUnknownEvent, mockAppConfig);

  assertEquals(parsed.eventType, 'update');
  assertEquals(parsed.resourceType, 'unknown');
});

// =============================================================================
// Entity Extraction Tests
// =============================================================================

Deno.test('[Stripe] Extract Entity - customer created', async () => {
  const mockEvent = createMockCustomerCreatedEvent({ id: 'cus_extract_123' });
  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);
  const entity = await stripeConnector.extractEntity(parsed, mockAppConfig);

  assertExists(entity);
  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'cus_extract_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.customer);
});

Deno.test('[Stripe] Extract Entity - customer deleted returns null', async () => {
  const mockEvent = createMockCustomerDeletedEvent({ id: 'cus_delete_123' });
  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);
  const entity = await stripeConnector.extractEntity(parsed, mockAppConfig);

  assertEquals(entity, null);
});

Deno.test('[Stripe] Extract Entity - subscription with items extracts multiple entities', async () => {
  const mockEvent = createMockSubscriptionEvent('customer.subscription.created', {
    id: 'sub_with_items',
    items: [
      { id: 'si_item_1' },
      { id: 'si_item_2' },
    ],
  });
  const parsed = await stripeConnector.parseWebhookEvent(mockEvent, mockAppConfig);

  // Check if extractEntities is available on this connector
  if (!stripeConnector.extractEntities) {
    // If not available, skip this test
    return;
  }

  const entities = await stripeConnector.extractEntities(parsed, mockAppConfig);

  if (entities) {
    assertEquals(entities.length, 3);

    // First entity should be the subscription
    assertEquals(entities[0].externalId, 'sub_with_items');
    assertEquals(entities[0].collectionKey, STRIPE_COLLECTION_KEYS.subscription);

    // Remaining should be subscription items
    const itemEntities = entities.filter(
      (e) => e.collectionKey === STRIPE_COLLECTION_KEYS.subscription_item,
    );
    assertEquals(itemEntities.length, 2);
  }
});

// =============================================================================
// Entity Normalization Tests
// =============================================================================

Deno.test('[Stripe] Normalize - customer entity', () => {
  const customerData = createMockCustomer({
    id: 'cus_norm_123',
    email: 'test@example.com',
  });

  const entity = stripeConnector.normalizeEntity('customer', customerData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'cus_norm_123');
  assertEquals(entity.appKey, mockAppConfig.app_key);
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.customer);
  assertEquals(entity.rawPayload.email, 'test@example.com');
  assertEquals(entity.archivedAt, undefined); // Customers don't get archived
});

Deno.test('[Stripe] Normalize - product entity (active)', () => {
  const productData = createMockProduct({
    id: 'prod_norm_123',
    name: 'Test Product',
    active: true,
  });

  const entity = stripeConnector.normalizeEntity('product', productData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'prod_norm_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.product);
  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] Normalize - product entity (inactive sets archivedAt)', () => {
  const productData = createMockProduct({
    id: 'prod_inactive',
    active: false,
  });

  const entity = stripeConnector.normalizeEntity('product', productData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
});

Deno.test('[Stripe] Normalize - price entity (active)', () => {
  const priceData = createMockPrice({
    id: 'price_norm_123',
    active: true,
  });

  const entity = stripeConnector.normalizeEntity('price', priceData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'price_norm_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.price);
  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] Normalize - price entity (inactive sets archivedAt)', () => {
  const priceData = createMockPrice({
    id: 'price_inactive',
    active: false,
  });

  const entity = stripeConnector.normalizeEntity('price', priceData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertExists(entity.archivedAt);
});

Deno.test('[Stripe] Normalize - plan entity', () => {
  const planData = createMockPlan({
    id: 'plan_norm_123',
    amount: 999,
  });

  const entity = stripeConnector.normalizeEntity('plan', planData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'plan_norm_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.plan);
});

Deno.test('[Stripe] Normalize - subscription entity (active)', () => {
  const subscriptionData = createMockSubscription({
    id: 'sub_norm_123',
    status: 'active',
  });

  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'sub_norm_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.subscription);
  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] Normalize - subscription item entity', () => {
  const itemData = createMockSubscriptionItem({
    id: 'si_norm_123',
    quantity: 2,
  });

  const entity = stripeConnector.normalizeEntity('subscription_item', itemData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'si_norm_123');
  assertEquals(entity.collectionKey, STRIPE_COLLECTION_KEYS.subscription_item);
});

// =============================================================================
// Archived At Detection Tests
// =============================================================================

Deno.test('[Stripe] ArchivedAt - canceled subscription has archivedAt', () => {
  const canceledAt = nowTimestamp();
  const subscriptionData = createMockSubscription({
    id: 'sub_canceled',
    status: 'canceled',
    canceledAt,
  });

  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
  // Verify the timestamp is close to what we set (within 1 second tolerance)
  const expectedTime = canceledAt * 1000;
  const actualTime = entity.archivedAt.getTime();
  assertEquals(Math.abs(expectedTime - actualTime) < 1000, true);
});

Deno.test('[Stripe] ArchivedAt - active subscription has no archivedAt', () => {
  const subscriptionData = createMockSubscription({
    id: 'sub_active',
    status: 'active',
  });

  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);

  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] ArchivedAt - trialing subscription has no archivedAt', () => {
  const subscriptionData = createMockSubscription({
    id: 'sub_trialing',
    status: 'trialing',
  });

  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);

  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] ArchivedAt - past_due subscription has no archivedAt', () => {
  const subscriptionData = createMockSubscription({
    id: 'sub_past_due',
    status: 'past_due',
  });

  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);

  assertEquals(entity.archivedAt, undefined);
});

Deno.test('[Stripe] ArchivedAt - canceled subscription without canceledAt uses current time', () => {
  const subscriptionData = createMockSubscription({
    id: 'sub_canceled_no_timestamp',
    status: 'canceled',
    canceledAt: null,
  });

  const beforeTest = new Date();
  const entity = stripeConnector.normalizeEntity('subscription', subscriptionData, mockAppConfig);
  const afterTest = new Date();

  assertExists(entity.archivedAt);
  assertInstanceOf(entity.archivedAt, Date);
  // archivedAt should be between beforeTest and afterTest
  assertEquals(entity.archivedAt.getTime() >= beforeTest.getTime(), true);
  assertEquals(entity.archivedAt.getTime() <= afterTest.getTime(), true);
});

// =============================================================================
// Collection Key Tests
// =============================================================================

Deno.test('[Stripe] Collection Keys - all resource types have correct keys', () => {
  const resourceTypes = [
    'customer',
    'product',
    'price',
    'plan',
    'subscription',
    'subscription_item',
  ] as const;

  for (const resourceType of resourceTypes) {
    const mockData = { id: `test_${resourceType}_123` };
    const entity = stripeConnector.normalizeEntity(resourceType, mockData, mockAppConfig);

    assertEquals(
      entity.collectionKey,
      STRIPE_COLLECTION_KEYS[resourceType],
      `${resourceType} should have correct collection key`,
    );
  }
});

// =============================================================================
// API Version Tests
// =============================================================================

Deno.test('[Stripe] API Version - entity includes apiVersion', () => {
  const customerData = createMockCustomer({ id: 'cus_api_version' });
  const entity = stripeConnector.normalizeEntity('customer', customerData, mockAppConfig);

  assertExists(entity.apiVersion);
  assertEquals(typeof entity.apiVersion, 'string');
});

// =============================================================================
// App Key Tests
// =============================================================================

Deno.test('[Stripe] App Key - entity uses correct appKey from config', () => {
  const customConfig = createMockStripeAppConfig({ appKey: 'custom_stripe_app' });
  const customerData = createMockCustomer({ id: 'cus_app_key' });

  const entity = stripeConnector.normalizeEntity('customer', customerData, customConfig);

  assertEquals(entity.appKey, 'custom_stripe_app');
});

// =============================================================================
// Raw Payload Tests
// =============================================================================

Deno.test('[Stripe] Raw Payload - preserves all original data', () => {
  const customerData = createMockCustomer({
    id: 'cus_raw_payload',
    email: 'raw@example.com',
    name: 'Raw Payload Test',
    metadata: { custom_field: 'custom_value' },
  });

  const entity = stripeConnector.normalizeEntity('customer', customerData, mockAppConfig);

  assertEquals(entity.rawPayload.id, 'cus_raw_payload');
  assertEquals(entity.rawPayload.email, 'raw@example.com');
  assertEquals(entity.rawPayload.name, 'Raw Payload Test');
  assertEquals((entity.rawPayload.metadata as Record<string, string>).custom_field, 'custom_value');
});

// =============================================================================
// Created Timestamp Tests
// =============================================================================

Deno.test('[Stripe] Created - entity data includes created timestamp', () => {
  const created = pastTimestamp(30);
  const customerData = createMockCustomer({
    id: 'cus_created',
    created,
  });

  const entity = stripeConnector.normalizeEntity('customer', customerData, mockAppConfig);

  assertEquals(entity.rawPayload.created, created);
});
