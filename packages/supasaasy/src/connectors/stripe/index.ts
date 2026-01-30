/**
 * Stripe Connector
 *
 * Implements the connector interface for Stripe integration.
 * Supports webhooks, full sync, and incremental sync for:
 * - Customers
 * - Products
 * - Prices
 * - Plans (legacy)
 * - Subscriptions
 * - Subscription Items
 */

import type {
  AppConfig,
  ConnectorMetadata,
  NormalizedEntity,
  SupportedResource,
} from '../../types/index.ts';
import type {
  ConfigValidationResult,
  IncrementalConnector,
  ValidatableConnector,
} from '../index.ts';
import { registerConnector } from '../index.ts';

// Import from modules
import {
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  DEFAULT_API_VERSION,
  validateStripeConfig,
} from './client.ts';
import { normalizeStripeEntity } from './normalization.ts';
import { extractEntities, extractEntity, parseWebhookEvent, verifyWebhook } from './webhooks.ts';
import { fullSync, incrementalSync } from './sync/index.ts';
import { STRIPE_COLLECTION_KEYS, type StripeResourceType } from './types.ts';

// =============================================================================
// Supported Resources
// =============================================================================

const SUPPORTED_RESOURCES: SupportedResource[] = [
  {
    resourceType: 'customer',
    collectionKey: STRIPE_COLLECTION_KEYS.customer,
    description: 'Stripe customers',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'product',
    collectionKey: STRIPE_COLLECTION_KEYS.product,
    description: 'Stripe products',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'price',
    collectionKey: STRIPE_COLLECTION_KEYS.price,
    description: 'Stripe prices',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'plan',
    collectionKey: STRIPE_COLLECTION_KEYS.plan,
    description: 'Stripe plans (legacy)',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'subscription',
    collectionKey: STRIPE_COLLECTION_KEYS.subscription,
    description: 'Stripe subscriptions',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'subscription_item',
    collectionKey: STRIPE_COLLECTION_KEYS.subscription_item,
    description: 'Stripe subscription items',
    supportsIncrementalSync: false,
    supportsWebhooks: false,
    syncedWithParent: 'subscription',
  },
];

// =============================================================================
// Migration Files
// =============================================================================

/**
 * List of migration files included with this connector.
 * These are assembled into the main migrations when the connector is configured.
 * Files are applied in order (sorted by filename).
 */
const MIGRATION_FILES = [
  '001_views.sql',
];

// =============================================================================
// Connector Metadata
// =============================================================================

const metadata: ConnectorMetadata = {
  name: CONNECTOR_NAME,
  displayName: 'Stripe',
  version: CONNECTOR_VERSION,
  apiVersion: DEFAULT_API_VERSION,
  supportedResources: SUPPORTED_RESOURCES,
  description:
    'Syncs customers, products, prices, plans, subscriptions, and subscription items from Stripe',
  migrations: MIGRATION_FILES,
};

// =============================================================================
// Connector Implementation
// =============================================================================

/**
 * Stripe connector implementation with configuration validation
 */
const stripeConnector: IncrementalConnector & ValidatableConnector = {
  metadata,

  verifyWebhook,
  parseWebhookEvent,
  extractEntity,
  extractEntities,

  normalizeEntity(
    resourceType: string,
    data: Record<string, unknown>,
    config: AppConfig,
  ): NormalizedEntity {
    return normalizeStripeEntity(resourceType as StripeResourceType, data, config);
  },

  fullSync,
  incrementalSync,

  validateConfig(appConfig: AppConfig): ConfigValidationResult {
    return validateStripeConfig(appConfig);
  },
};

// =============================================================================
// Registration
// =============================================================================

// Register the connector with the registry
registerConnector(CONNECTOR_NAME, () => stripeConnector);

// Export for direct use
export default stripeConnector;
export { metadata, stripeConnector };

// Re-export modules for direct access if needed
export * from './client.ts';
export * from './normalization.ts';
export * from './webhooks.ts';
export * from './types.ts';
