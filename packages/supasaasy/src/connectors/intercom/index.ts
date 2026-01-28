/**
 * Intercom Connector
 *
 * Implements the connector interface for Intercom integration.
 * Supports webhooks, full sync, and incremental sync for:
 * - Companies
 * - Contacts
 * - Admins
 * - Conversations
 * - Conversation Parts
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

import {
  CONNECTOR_NAME,
  CONNECTOR_VERSION,
  DEFAULT_API_VERSION,
  validateIntercomConfig,
} from './client.ts';
import { normalizeIntercomEntity } from './normalization.ts';
import {
  extractEntities,
  extractEntity,
  parseWebhookEvent,
  verifyWebhook,
} from './webhooks.ts';
import { fullSync, incrementalSync } from './sync/index.ts';
import {
  INTERCOM_COLLECTION_KEYS,
  type IntercomResourceType,
} from './types.ts';

// =============================================================================
// Supported Resources
// =============================================================================

const SUPPORTED_RESOURCES: SupportedResource[] = [
  {
    resourceType: 'company',
    collectionKey: INTERCOM_COLLECTION_KEYS.company,
    description: 'Intercom companies',
    supportsIncrementalSync: false, // Intercom doesn't support company incremental sync via API
    supportsWebhooks: true,
  },
  {
    resourceType: 'contact',
    collectionKey: INTERCOM_COLLECTION_KEYS.contact,
    description: 'Intercom contacts (users and leads)',
    supportsIncrementalSync: false, // Intercom doesn't support contact incremental sync via API
    supportsWebhooks: true,
  },
  {
    resourceType: 'admin',
    collectionKey: INTERCOM_COLLECTION_KEYS.admin,
    description: 'Intercom admins (team members)',
    supportsIncrementalSync: false,
    supportsWebhooks: false, // Intercom doesn't have admin webhooks
  },
  {
    resourceType: 'conversation',
    collectionKey: INTERCOM_COLLECTION_KEYS.conversation,
    description: 'Intercom conversations',
    supportsIncrementalSync: true, // Via search endpoint
    supportsWebhooks: true,
  },
  {
    resourceType: 'conversation_part',
    collectionKey: INTERCOM_COLLECTION_KEYS.conversation_part,
    description: 'Intercom conversation parts (messages)',
    supportsIncrementalSync: false, // Synced with conversations
    supportsWebhooks: false, // Synced via conversation webhooks
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
  displayName: 'Intercom',
  version: CONNECTOR_VERSION,
  apiVersion: DEFAULT_API_VERSION,
  supportedResources: SUPPORTED_RESOURCES,
  description:
    'Syncs companies, contacts, admins, conversations, and conversation parts from Intercom',
  migrations: MIGRATION_FILES,
};

// =============================================================================
// Connector Implementation
// =============================================================================

/**
 * Intercom connector implementation with configuration validation
 */
const intercomConnector: IncrementalConnector & ValidatableConnector = {
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
    return normalizeIntercomEntity(resourceType as IntercomResourceType, data, config);
  },

  fullSync,
  incrementalSync,

  validateConfig(appConfig: AppConfig): ConfigValidationResult {
    return validateIntercomConfig(appConfig);
  },
};

// =============================================================================
// Registration
// =============================================================================

// Register the connector with the registry
registerConnector(CONNECTOR_NAME, () => intercomConnector);

// Export for direct use
export default intercomConnector;
export { metadata, intercomConnector };

// Re-export modules for direct access if needed
export * from './client.ts';
export * from './normalization.ts';
export * from './webhooks.ts';
export * from './types.ts';
