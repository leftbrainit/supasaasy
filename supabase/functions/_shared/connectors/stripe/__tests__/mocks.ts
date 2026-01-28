/**
 * Stripe Mock Data Generators
 *
 * Creates realistic Stripe API response mocks for testing.
 */

import type { StripeResourceType, StripeWebhookEventType } from '../types.ts';

// =============================================================================
// Timestamp Helpers
// =============================================================================

/**
 * Get current Unix timestamp in seconds
 */
export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get Unix timestamp for a date in the past
 */
export function pastTimestamp(daysAgo: number): number {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return Math.floor(date.getTime() / 1000);
}

// =============================================================================
// Customer Mocks
// =============================================================================

export interface MockCustomerOptions {
  id?: string;
  email?: string;
  name?: string;
  created?: number;
  deleted?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe customer object
 */
export function createMockCustomer(options: MockCustomerOptions = {}): Record<string, unknown> {
  const {
    id = `cus_${randomId()}`,
    email = 'test@example.com',
    name = 'Test Customer',
    created = nowTimestamp(),
    deleted = false,
    metadata = {},
  } = options;

  if (deleted) {
    return {
      id,
      object: 'customer',
      deleted: true,
    };
  }

  return {
    id,
    object: 'customer',
    address: null,
    balance: 0,
    created,
    currency: 'usd',
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email,
    invoice_prefix: id.substring(4, 12).toUpperCase(),
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata,
    name,
    next_invoice_sequence: 1,
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
  };
}

// =============================================================================
// Product Mocks
// =============================================================================

export interface MockProductOptions {
  id?: string;
  name?: string;
  description?: string;
  active?: boolean;
  created?: number;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe product object
 */
export function createMockProduct(options: MockProductOptions = {}): Record<string, unknown> {
  const {
    id = `prod_${randomId()}`,
    name = 'Test Product',
    description = 'A test product',
    active = true,
    created = nowTimestamp(),
    metadata = {},
  } = options;

  return {
    id,
    object: 'product',
    active,
    created,
    default_price: null,
    description,
    images: [],
    livemode: false,
    metadata,
    name,
    package_dimensions: null,
    shippable: null,
    statement_descriptor: null,
    tax_code: null,
    unit_label: null,
    updated: created,
    url: null,
  };
}

// =============================================================================
// Price Mocks
// =============================================================================

export interface MockPriceOptions {
  id?: string;
  productId?: string;
  unitAmount?: number;
  currency?: string;
  active?: boolean;
  recurring?: boolean;
  interval?: 'day' | 'week' | 'month' | 'year';
  created?: number;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe price object
 */
export function createMockPrice(options: MockPriceOptions = {}): Record<string, unknown> {
  const {
    id = `price_${randomId()}`,
    productId = `prod_${randomId()}`,
    unitAmount = 1000,
    currency = 'usd',
    active = true,
    recurring = true,
    interval = 'month',
    created = nowTimestamp(),
    metadata = {},
  } = options;

  return {
    id,
    object: 'price',
    active,
    billing_scheme: 'per_unit',
    created,
    currency,
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata,
    nickname: null,
    product: productId,
    recurring: recurring
      ? {
        aggregate_usage: null,
        interval,
        interval_count: 1,
        trial_period_days: null,
        usage_type: 'licensed',
      }
      : null,
    tax_behavior: 'unspecified',
    tiers_mode: null,
    transform_quantity: null,
    type: recurring ? 'recurring' : 'one_time',
    unit_amount: unitAmount,
    unit_amount_decimal: String(unitAmount),
  };
}

// =============================================================================
// Plan Mocks (Legacy)
// =============================================================================

export interface MockPlanOptions {
  id?: string;
  productId?: string;
  amount?: number;
  currency?: string;
  interval?: 'day' | 'week' | 'month' | 'year';
  active?: boolean;
  created?: number;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe plan object (legacy)
 */
export function createMockPlan(options: MockPlanOptions = {}): Record<string, unknown> {
  const {
    id = `plan_${randomId()}`,
    productId = `prod_${randomId()}`,
    amount = 1000,
    currency = 'usd',
    interval = 'month',
    active = true,
    created = nowTimestamp(),
    metadata = {},
  } = options;

  return {
    id,
    object: 'plan',
    active,
    aggregate_usage: null,
    amount,
    amount_decimal: String(amount),
    billing_scheme: 'per_unit',
    created,
    currency,
    interval,
    interval_count: 1,
    livemode: false,
    metadata,
    nickname: null,
    product: productId,
    tiers_mode: null,
    transform_usage: null,
    trial_period_days: null,
    usage_type: 'licensed',
  };
}

// =============================================================================
// Subscription Mocks
// =============================================================================

export interface MockSubscriptionItemOptions {
  id?: string;
  subscriptionId?: string;
  priceId?: string;
  quantity?: number;
  created?: number;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe subscription item object
 */
export function createMockSubscriptionItem(
  options: MockSubscriptionItemOptions = {},
): Record<string, unknown> {
  const {
    id = `si_${randomId()}`,
    subscriptionId = `sub_${randomId()}`,
    priceId = `price_${randomId()}`,
    quantity = 1,
    created = nowTimestamp(),
    metadata = {},
  } = options;

  return {
    id,
    object: 'subscription_item',
    billing_thresholds: null,
    created,
    metadata,
    price: createMockPrice({ id: priceId }),
    quantity,
    subscription: subscriptionId,
    tax_rates: [],
  };
}

export interface MockSubscriptionOptions {
  id?: string;
  customerId?: string;
  status?:
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  created?: number;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  canceledAt?: number | null;
  items?: MockSubscriptionItemOptions[];
  hasMoreItems?: boolean;
  metadata?: Record<string, string>;
}

/**
 * Create a mock Stripe subscription object
 */
export function createMockSubscription(
  options: MockSubscriptionOptions = {},
): Record<string, unknown> {
  const {
    id = `sub_${randomId()}`,
    customerId = `cus_${randomId()}`,
    status = 'active',
    created = nowTimestamp(),
    currentPeriodStart = nowTimestamp(),
    currentPeriodEnd = nowTimestamp() + 30 * 24 * 60 * 60,
    canceledAt = null,
    items = [{}],
    hasMoreItems = false,
    metadata = {},
  } = options;

  const subscriptionItems = items.map((itemOptions, _index) =>
    createMockSubscriptionItem({
      subscriptionId: id,
      ...itemOptions,
    })
  );

  return {
    id,
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
      liability: null,
    },
    billing_cycle_anchor: currentPeriodStart,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: canceledAt,
    cancellation_details: canceledAt
      ? {
        comment: null,
        feedback: null,
        reason: 'cancellation_requested',
      }
      : null,
    collection_method: 'charge_automatically',
    created,
    currency: 'usd',
    current_period_end: currentPeriodEnd,
    current_period_start: currentPeriodStart,
    customer: customerId,
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: status === 'canceled' ? canceledAt : null,
    items: {
      object: 'list',
      data: subscriptionItems,
      has_more: hasMoreItems,
      url: `/v1/subscription_items?subscription=${id}`,
    },
    latest_invoice: null,
    livemode: false,
    metadata,
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: created,
    status,
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'create_invoice',
      },
    },
    trial_start: null,
  };
}

// =============================================================================
// Webhook Event Mocks
// =============================================================================

export interface MockWebhookEventOptions {
  id?: string;
  type: StripeWebhookEventType;
  data: Record<string, unknown>;
  created?: number;
  livemode?: boolean;
  apiVersion?: string;
}

/**
 * Create a mock Stripe webhook event
 */
export function createMockStripeEvent(options: MockWebhookEventOptions): Record<string, unknown> {
  const {
    id = `evt_${randomId()}`,
    type,
    data,
    created = nowTimestamp(),
    livemode = false,
    apiVersion = '2025-02-24.acacia',
  } = options;

  return {
    id,
    object: 'event',
    api_version: apiVersion,
    created,
    data: {
      object: data,
    },
    livemode,
    pending_webhooks: 1,
    request: {
      id: `req_${randomId()}`,
      idempotency_key: null,
    },
    type,
  };
}

/**
 * Create a mock customer.created webhook event
 */
export function createMockCustomerCreatedEvent(
  customerOptions: MockCustomerOptions = {},
): Record<string, unknown> {
  return createMockStripeEvent({
    type: 'customer.created',
    data: createMockCustomer(customerOptions),
  });
}

/**
 * Create a mock customer.updated webhook event
 */
export function createMockCustomerUpdatedEvent(
  customerOptions: MockCustomerOptions = {},
): Record<string, unknown> {
  return createMockStripeEvent({
    type: 'customer.updated',
    data: createMockCustomer(customerOptions),
  });
}

/**
 * Create a mock customer.deleted webhook event
 */
export function createMockCustomerDeletedEvent(
  customerOptions: MockCustomerOptions = {},
): Record<string, unknown> {
  return createMockStripeEvent({
    type: 'customer.deleted',
    data: createMockCustomer({ ...customerOptions, deleted: true }),
  });
}

/**
 * Create a mock subscription webhook event
 */
export function createMockSubscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  subscriptionOptions: MockSubscriptionOptions = {},
): Record<string, unknown> {
  // For deleted subscriptions, set canceled status
  if (type === 'customer.subscription.deleted') {
    subscriptionOptions = {
      ...subscriptionOptions,
      status: 'canceled',
      canceledAt: subscriptionOptions.canceledAt ?? nowTimestamp(),
    };
  }

  return createMockStripeEvent({
    type,
    data: createMockSubscription(subscriptionOptions),
  });
}

// =============================================================================
// API Response Mocks
// =============================================================================

/**
 * Create a mock Stripe list response
 */
export function createMockListResponse<T>(
  data: T[],
  hasMore = false,
  url = '/v1/objects',
): { object: 'list'; data: T[]; has_more: boolean; url: string } {
  return {
    object: 'list',
    data,
    has_more: hasMore,
    url,
  };
}

// =============================================================================
// Stripe App Config Mock
// =============================================================================

export interface MockStripeAppConfigOptions {
  appKey?: string;
  apiKey?: string;
  webhookSecret?: string;
  syncResources?: StripeResourceType[];
  syncFrom?: string;
}

/**
 * Create a mock Stripe app configuration
 */
export function createMockStripeAppConfig(options: MockStripeAppConfigOptions = {}) {
  const {
    appKey = 'stripe_test',
    apiKey = 'sk_test_mock',
    webhookSecret = 'whsec_test_mock',
    syncResources,
    syncFrom,
  } = options;

  return {
    app_key: appKey,
    name: 'Stripe Test',
    connector: 'stripe',
    config: {
      api_key: apiKey,
      webhook_secret: webhookSecret,
      ...(syncResources && { sync_resources: syncResources }),
      ...(syncFrom && { sync_from: syncFrom }),
    },
    ...(syncFrom && { sync_from: syncFrom }),
  };
}

// =============================================================================
// Utility Helpers
// =============================================================================

/**
 * Generate a random ID string
 */
function randomId(length = 14): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Create mock entity data for a given resource type
 */
export function createMockEntityData(
  resourceType: StripeResourceType,
  options: Record<string, unknown> = {},
): Record<string, unknown> {
  switch (resourceType) {
    case 'customer':
      return createMockCustomer(options as MockCustomerOptions);
    case 'product':
      return createMockProduct(options as MockProductOptions);
    case 'price':
      return createMockPrice(options as MockPriceOptions);
    case 'plan':
      return createMockPlan(options as MockPlanOptions);
    case 'subscription':
      return createMockSubscription(options as MockSubscriptionOptions);
    case 'subscription_item':
      return createMockSubscriptionItem(options as MockSubscriptionItemOptions);
    default:
      throw new Error(`Unknown resource type: ${resourceType}`);
  }
}
