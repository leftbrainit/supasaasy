/**
 * Notion Connector
 *
 * Implements the connector interface for Notion integration.
 * Supports webhooks, full sync, and incremental sync for:
 * - Data Sources (tables within databases)
 * - Data Source Properties (schema/properties)
 * - Pages (database rows/items)
 * - Users (workspace members)
 *
 * Uses Notion API version 2025-09-03 with first-class data source support.
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
  validateNotionConfig,
} from './client.ts';
import { normalizeNotionEntity } from './normalization.ts';
import { extractEntities, extractEntity, parseWebhookEvent, verifyWebhook } from './webhooks.ts';
import { fullSync, incrementalSync } from './sync/index.ts';
import { NOTION_COLLECTION_KEYS, type NotionResourceType } from './types.ts';

// =============================================================================
// Supported Resources
// =============================================================================

const SUPPORTED_RESOURCES: SupportedResource[] = [
  {
    resourceType: 'data_source',
    collectionKey: NOTION_COLLECTION_KEYS.data_source,
    description: 'Notion data sources (tables within databases)',
    supportsIncrementalSync: false, // Notion doesn't support data source incremental sync via API
    supportsWebhooks: true,
  },
  {
    resourceType: 'data_source_property',
    collectionKey: NOTION_COLLECTION_KEYS.data_source_property,
    description: 'Notion data source properties (schema)',
    supportsIncrementalSync: false, // Synced with data sources
    supportsWebhooks: false, // Synced via data source webhooks
  },
  {
    resourceType: 'page',
    collectionKey: NOTION_COLLECTION_KEYS.page,
    description: 'Notion pages (database rows)',
    supportsIncrementalSync: true, // Via last_edited_time filter
    supportsWebhooks: true,
  },
  {
    resourceType: 'user',
    collectionKey: NOTION_COLLECTION_KEYS.user,
    description: 'Notion workspace users (people and bots)',
    supportsIncrementalSync: false,
    supportsWebhooks: false, // Notion doesn't have user webhooks
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
  displayName: 'Notion',
  version: CONNECTOR_VERSION,
  apiVersion: DEFAULT_API_VERSION,
  supportedResources: SUPPORTED_RESOURCES,
  description:
    'Syncs data sources, data source properties, pages, and users from Notion workspaces',
  migrations: MIGRATION_FILES,
};

// =============================================================================
// Connector Implementation
// =============================================================================

/**
 * Notion connector implementation with configuration validation
 */
const notionConnector: IncrementalConnector & ValidatableConnector = {
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
    return normalizeNotionEntity(resourceType as NotionResourceType, data, config);
  },

  fullSync,
  incrementalSync,

  validateConfig(appConfig: AppConfig): ConfigValidationResult {
    return validateNotionConfig(appConfig);
  },
};

// =============================================================================
// Registration
// =============================================================================

// Register the connector with the registry
registerConnector(CONNECTOR_NAME, () => notionConnector);

// Export for direct use
export default notionConnector;
export { notionConnector, metadata };

// Re-export modules for direct access if needed
export * from './client.ts';
export * from './normalization.ts';
export * from './webhooks.ts';
export * from './types.ts';
