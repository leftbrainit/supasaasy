/**
 * Stripe Connector Types
 *
 * Type definitions specific to the Stripe connector.
 */

import type Stripe from 'stripe';

// =============================================================================
// Resource Types
// =============================================================================

/**
 * Stripe resource types supported by this connector
 */
export type StripeResourceType =
  | 'customer'
  | 'product'
  | 'price'
  | 'plan'
  | 'subscription'
  | 'subscription_item';

/**
 * Mapping of Stripe resource types to collection keys
 */
export const STRIPE_COLLECTION_KEYS: Record<StripeResourceType, string> = {
  customer: 'stripe_customer',
  product: 'stripe_product',
  price: 'stripe_price',
  plan: 'stripe_plan',
  subscription: 'stripe_subscription',
  subscription_item: 'stripe_subscription_item',
};

// =============================================================================
// Webhook Event Types
// =============================================================================

/**
 * Stripe webhook events we handle
 */
export const STRIPE_WEBHOOK_EVENTS = {
  // Customer events
  'customer.created': { resourceType: 'customer', eventType: 'create' },
  'customer.updated': { resourceType: 'customer', eventType: 'update' },
  'customer.deleted': { resourceType: 'customer', eventType: 'delete' },

  // Product events
  'product.created': { resourceType: 'product', eventType: 'create' },
  'product.updated': { resourceType: 'product', eventType: 'update' },
  'product.deleted': { resourceType: 'product', eventType: 'delete' },

  // Price events
  'price.created': { resourceType: 'price', eventType: 'create' },
  'price.updated': { resourceType: 'price', eventType: 'update' },
  'price.deleted': { resourceType: 'price', eventType: 'delete' },

  // Plan events (legacy)
  'plan.created': { resourceType: 'plan', eventType: 'create' },
  'plan.updated': { resourceType: 'plan', eventType: 'update' },
  'plan.deleted': { resourceType: 'plan', eventType: 'delete' },

  // Subscription events
  'customer.subscription.created': { resourceType: 'subscription', eventType: 'create' },
  'customer.subscription.updated': { resourceType: 'subscription', eventType: 'update' },
  'customer.subscription.deleted': { resourceType: 'subscription', eventType: 'archive' },
} as const;

export type StripeWebhookEventType = keyof typeof STRIPE_WEBHOOK_EVENTS;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Stripe-specific app configuration
 */
export interface StripeAppConfig {
  /** Environment variable name for the API key */
  api_key_env?: string;
  /** Environment variable name for the webhook signing secret */
  webhook_secret_env?: string;
  /** Direct API key (not recommended for production) */
  api_key?: string;
  /** Direct webhook secret (not recommended for production) */
  webhook_secret?: string;
  /** Resource types to sync (defaults to all) */
  sync_resources?: StripeResourceType[];
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Generic paginated list response from Stripe
 */
export interface StripePaginatedResponse<T> {
  object: 'list';
  data: T[];
  has_more: boolean;
  url: string;
}

/**
 * Union type for all Stripe objects we sync
 */
export type StripeObject =
  | Stripe.Customer
  | Stripe.Product
  | Stripe.Price
  | Stripe.Plan
  | Stripe.Subscription
  | Stripe.SubscriptionItem;
