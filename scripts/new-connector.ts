#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Connector Template Generator
 *
 * Creates a new connector with the correct file structure and boilerplate.
 *
 * Usage:
 *   deno task new-connector <connector-name>
 *
 * Example:
 *   deno task new-connector hubspot
 */

const CONNECTORS_DIR = 'supabase/functions/_shared/connectors';

// =============================================================================
// Template Files
// =============================================================================

function getTypesTemplate(name: string, pascalName: string): string {
  const upperName = name.replace(/-/g, '_').toUpperCase();
  const snakeName = name.replace(/-/g, '_');

  return `/**
 * ${pascalName} Connector Types
 *
 * Type definitions specific to the ${pascalName} connector.
 */

// =============================================================================
// Resource Types
// =============================================================================

/**
 * ${pascalName} resource types supported by this connector
 */
export type ${pascalName}ResourceType =
  | 'contact'
  | 'company';
  // Add more resource types as needed

/**
 * Mapping of ${pascalName} resource types to collection keys
 */
export const ${upperName}_COLLECTION_KEYS: Record<${pascalName}ResourceType, string> = {
  contact: '${snakeName}_contact',
  company: '${snakeName}_company',
  // Add more mappings as needed
};

// =============================================================================
// Webhook Event Types
// =============================================================================

/**
 * ${pascalName} webhook events we handle
 */
export const ${upperName}_WEBHOOK_EVENTS = {
  // Contact events
  'contact.created': { resourceType: 'contact', eventType: 'create' },
  'contact.updated': { resourceType: 'contact', eventType: 'update' },
  'contact.deleted': { resourceType: 'contact', eventType: 'delete' },

  // Company events
  'company.created': { resourceType: 'company', eventType: 'create' },
  'company.updated': { resourceType: 'company', eventType: 'update' },
  'company.deleted': { resourceType: 'company', eventType: 'delete' },
} as const;

export type ${pascalName}WebhookEventType = keyof typeof ${upperName}_WEBHOOK_EVENTS;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * ${pascalName}-specific app configuration
 */
export interface ${pascalName}AppConfig {
  /** Environment variable name for the API key */
  api_key_env?: string;
  /** Environment variable name for the webhook signing secret */
  webhook_secret_env?: string;
  /** Direct API key (not recommended for production) */
  api_key?: string;
  /** Direct webhook secret (not recommended for production) */
  webhook_secret?: string;
  /** Resource types to sync (defaults to all) */
  sync_resources?: ${pascalName}ResourceType[];
  /**
   * Optional minimum timestamp for historical data sync (ISO 8601 string).
   * When set, full sync will only fetch records created on or after this date.
   */
  sync_from?: string;
}
`;
}

function getClientTemplate(name: string, pascalName: string): string {
  const upperName = name.replace(/-/g, '_').toUpperCase();

  return `/**
 * ${pascalName} Client Module
 *
 * Handles ${pascalName} API client creation and configuration helpers.
 */

import type { AppConfig } from '../../types/index.ts';
import type { ConfigValidationError, ConfigValidationResult } from '../index.ts';
import { createConnectorLogger } from '../utils.ts';
import type { ${pascalName}AppConfig, ${pascalName}ResourceType } from './types.ts';

// =============================================================================
// Constants
// =============================================================================

export const CONNECTOR_NAME = '${name}';
export const CONNECTOR_VERSION = '1.0.0';
export const DEFAULT_API_VERSION = '1.0';
export const DEFAULT_PAGE_SIZE = 100;

export const logger = createConnectorLogger(CONNECTOR_NAME);

/** Valid ${pascalName} resource types */
const VALID_RESOURCE_TYPES: ${pascalName}ResourceType[] = [
  'contact',
  'company',
  // Add more resource types as needed
];

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Get ${pascalName} client configuration from app config
 */
export function get${pascalName}Config(appConfig: AppConfig): ${pascalName}AppConfig {
  return appConfig.config as ${pascalName}AppConfig;
}

/**
 * Get the ${pascalName} API key from environment or config
 */
export function getApiKey(appConfig: AppConfig): string {
  const config = get${pascalName}Config(appConfig);

  if (config.api_key_env) {
    const apiKey = Deno.env.get(config.api_key_env);
    if (apiKey) return apiKey;
  }

  if (config.api_key) {
    return config.api_key;
  }

  const defaultEnvKey = \`${upperName}_API_KEY_\${appConfig.app_key.toUpperCase()}\`;
  const defaultApiKey = Deno.env.get(defaultEnvKey);
  if (defaultApiKey) return defaultApiKey;

  throw new Error(\`No ${pascalName} API key found for app \${appConfig.app_key}\`);
}

/**
 * Get the webhook signing secret from environment or config
 */
export function getWebhookSecret(appConfig: AppConfig): string {
  const config = get${pascalName}Config(appConfig);

  if (config.webhook_secret_env) {
    const secret = Deno.env.get(config.webhook_secret_env);
    if (secret) return secret;
  }

  if (config.webhook_secret) {
    return config.webhook_secret;
  }

  const defaultEnvKey = \`${upperName}_WEBHOOK_SECRET_\${appConfig.app_key.toUpperCase()}\`;
  const defaultSecret = Deno.env.get(defaultEnvKey);
  if (defaultSecret) return defaultSecret;

  throw new Error(\`No ${pascalName} webhook secret found for app \${appConfig.app_key}\`);
}

/**
 * Create a ${pascalName} API client for the given app configuration
 * TODO: Replace with actual SDK or HTTP client
 */
export function create${pascalName}Client(appConfig: AppConfig): unknown {
  const apiKey = getApiKey(appConfig);
  // TODO: Initialize your API client here
  return { apiKey };
}

/**
 * Get resource types to sync from config or defaults
 */
export function getResourceTypesToSync(appConfig: AppConfig): ${pascalName}ResourceType[] {
  const config = get${pascalName}Config(appConfig);
  if (config.sync_resources && config.sync_resources.length > 0) {
    return config.sync_resources;
  }
  return ['contact', 'company'];
}

/**
 * Get sync_from timestamp from app config if configured
 */
export function getSyncFromTimestamp(appConfig: AppConfig): number | undefined {
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', \`Invalid sync_from date in AppConfig: \${appConfig.sync_from}\`);
  }

  const config = get${pascalName}Config(appConfig);
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', \`Invalid sync_from date in ${pascalName}AppConfig: \${config.sync_from}\`);
  }

  return undefined;
}

// =============================================================================
// Configuration Validation
// =============================================================================

/**
 * Validate ${pascalName} connector configuration
 */
export function validate${pascalName}Config(appConfig: AppConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const config = get${pascalName}Config(appConfig);

  // Validate API key configuration
  const hasApiKeyEnv = config.api_key_env && Deno.env.get(config.api_key_env);
  const hasApiKey = !!config.api_key;
  const hasDefaultApiKey = Deno.env.get(\`${upperName}_API_KEY_\${appConfig.app_key.toUpperCase()}\`);

  if (!hasApiKeyEnv && !hasApiKey && !hasDefaultApiKey) {
    errors.push({
      field: 'api_key',
      message: 'No ${pascalName} API key configured',
      suggestion: \`Set \${config.api_key_env || \`${upperName}_API_KEY_\${appConfig.app_key.toUpperCase()}\`} environment variable\`,
    });
  }

  // Validate sync_resources if provided
  if (config.sync_resources && config.sync_resources.length > 0) {
    for (const resource of config.sync_resources) {
      if (!VALID_RESOURCE_TYPES.includes(resource)) {
        errors.push({
          field: 'sync_resources',
          message: \`Invalid resource type: \${resource}\`,
          suggestion: \`Valid types are: \${VALID_RESOURCE_TYPES.join(', ')}\`,
        });
      }
    }
  }

  // Validate sync_from date format if provided
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: \`Invalid date format: \${config.sync_from}\`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
`;
}

function getNormalizationTemplate(name: string, pascalName: string): string {
  const upperName = name.replace(/-/g, '_').toUpperCase();

  return `/**
 * ${pascalName} Normalization Module
 *
 * Handles entity normalization and archived state detection.
 */

import type { AppConfig, NormalizedEntity } from '../../types/index.ts';
import { createNormalizedEntity } from '../utils.ts';
import { DEFAULT_API_VERSION } from './client.ts';
import { ${upperName}_COLLECTION_KEYS, type ${pascalName}ResourceType } from './types.ts';

// =============================================================================
// Archived State Detection
// =============================================================================

/**
 * Detect archived state for a ${pascalName} object based on resource type
 */
export function detectArchivedAt(
  _resourceType: ${pascalName}ResourceType,
  data: Record<string, unknown>,
): Date | undefined {
  // TODO: Implement archived state detection based on your API's patterns
  // Common patterns:
  // - Check for 'archived', 'deleted', 'is_deleted' fields
  // - Check for status fields like 'status: archived'

  if (data.deleted === true || data.archived === true) {
    const timestamp = data.deleted_at || data.archived_at;
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    return new Date();
  }

  return undefined;
}

// =============================================================================
// Entity Normalization
// =============================================================================

/**
 * Normalize a ${pascalName} object to the canonical entity format
 */
export function normalize${pascalName}Entity(
  resourceType: ${pascalName}ResourceType,
  data: Record<string, unknown>,
  appConfig: AppConfig,
): NormalizedEntity {
  const externalId = data.id as string;
  const collectionKey = ${upperName}_COLLECTION_KEYS[resourceType];
  const archivedAt = detectArchivedAt(resourceType, data);

  return createNormalizedEntity({
    externalId,
    appKey: appConfig.app_key,
    collectionKey,
    rawPayload: data,
    apiVersion: DEFAULT_API_VERSION,
    archivedAt,
  });
}
`;
}

function getWebhooksTemplate(name: string, pascalName: string): string {
  const upperName = name.replace(/-/g, '_').toUpperCase();

  return `/**
 * ${pascalName} Webhooks Module
 *
 * Handles webhook verification, parsing, and entity extraction.
 */

import type {
  AppConfig,
  NormalizedEntity,
  ParsedWebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
} from '../../types/index.ts';
import { getWebhookSecret, logger } from './client.ts';
import { normalize${pascalName}Entity } from './normalization.ts';
import {
  ${upperName}_WEBHOOK_EVENTS,
  type ${pascalName}ResourceType,
  type ${pascalName}WebhookEventType,
} from './types.ts';

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Verify incoming webhook signature
 * TODO: Implement actual signature verification for your provider
 */
export async function verifyWebhook(
  request: Request,
  appConfig: AppConfig,
): Promise<WebhookVerificationResult> {
  try {
    // Get webhook secret for signature verification
    const webhookSecret = getWebhookSecret(appConfig);
    const body = await request.text();

    // TODO: Implement actual signature verification using webhookSecret
    console.debug(\`Verifying webhook with secret length: \${webhookSecret.length}\`);

    // TODO: Get the signature header (provider-specific)
    const signature = request.headers.get('x-${name}-signature');
    if (!signature) {
      return {
        valid: false,
        reason: 'Missing signature header',
      };
    }

    // TODO: Implement actual signature verification
    // This is a placeholder - replace with your provider's verification logic
    const payload = JSON.parse(body);

    return {
      valid: true,
      payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('webhook', \`Verification failed: \${message}\`);
    return {
      valid: false,
      reason: \`Webhook verification failed: \${message}\`,
    };
  }
}

// =============================================================================
// Webhook Event Parsing
// =============================================================================

/**
 * Parse a verified webhook event into our normalized format
 */
// deno-lint-ignore require-await
export async function parseWebhookEvent(
  payload: unknown,
  _appConfig: AppConfig,
): Promise<ParsedWebhookEvent> {
  const event = payload as Record<string, unknown>;
  const eventType = event.type as ${pascalName}WebhookEventType;

  const mapping = ${upperName}_WEBHOOK_EVENTS[eventType];
  if (!mapping) {
    logger.warn('webhook', \`Unknown event type: \${eventType}\`);
    return {
      eventType: 'update',
      originalEventType: eventType,
      resourceType: 'unknown',
      externalId: '',
      data: event.data as Record<string, unknown> ?? {},
      timestamp: new Date(),
      metadata: {},
    };
  }

  const data = event.data as Record<string, unknown>;
  const externalId = data?.id as string ?? '';

  return {
    eventType: mapping.eventType as WebhookEventType,
    originalEventType: eventType,
    resourceType: mapping.resourceType,
    externalId,
    data,
    timestamp: new Date(),
    metadata: {},
  };
}

// =============================================================================
// Entity Extraction
// =============================================================================

/**
 * Extract and normalize entity from webhook event
 */
// deno-lint-ignore require-await
export async function extractEntity(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity | null> {
  if (event.resourceType === 'unknown') {
    return null;
  }

  if (event.eventType === 'delete') {
    return null;
  }

  const resourceType = event.resourceType as ${pascalName}ResourceType;
  return normalize${pascalName}Entity(resourceType, event.data, appConfig);
}

/**
 * Extract and normalize multiple entities from webhook event
 */
// deno-lint-ignore require-await
export async function extractEntities(
  event: ParsedWebhookEvent,
  appConfig: AppConfig,
): Promise<NormalizedEntity[]> {
  const entities: NormalizedEntity[] = [];

  if (event.resourceType === 'unknown' || event.eventType === 'delete') {
    return entities;
  }

  const resourceType = event.resourceType as ${pascalName}ResourceType;
  const mainEntity = normalize${pascalName}Entity(resourceType, event.data, appConfig);
  entities.push(mainEntity);

  return entities;
}
`;
}

function getSyncIndexTemplate(name: string, pascalName: string): string {
  return `/**
 * ${pascalName} Sync Module
 *
 * Orchestrates full and incremental sync operations.
 */

import type { AppConfig, SyncOptions, SyncResult } from '../../../types/index.ts';
import { createTimer, failedSyncResult, mergeSyncResults } from '../../utils.ts';
import {
  getResourceTypesToSync,
  getSyncFromTimestamp,
  logger,
} from '../client.ts';

// =============================================================================
// Full Sync
// =============================================================================

/**
 * Perform a full sync of all configured resources
 */
export async function fullSync(
  appConfig: AppConfig,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const timer = createTimer();
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);
  const syncFromTimestamp = getSyncFromTimestamp(appConfig);

  if (syncFromTimestamp) {
    const syncFromDate = new Date(syncFromTimestamp * 1000).toISOString();
    logger.info('sync', \`sync_from configured: syncing records created on or after \${syncFromDate}\`);
  }

  logger.syncStarted('full', resourceTypes);

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    // TODO: Implement sync for each resource type
    logger.info('sync', \`Syncing \${resourceType}...\`);

    // Placeholder result - replace with actual sync implementation
    const syncResult = failedSyncResult(\`Sync not implemented for \${resourceType}\`);
    results.push(syncResult);
  }

  const merged = mergeSyncResults(results);
  merged.durationMs = timer.elapsed();

  logger.syncCompleted(merged);
  return merged;
}

// =============================================================================
// Incremental Sync
// =============================================================================

/**
 * Perform an incremental sync since the last sync time
 */
export async function incrementalSync(
  appConfig: AppConfig,
  since: Date,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const timer = createTimer();
  const resourceTypes = options.resourceTypes || getResourceTypesToSync(appConfig);

  logger.syncStarted('incremental', resourceTypes);

  const results: SyncResult[] = [];

  for (const resourceType of resourceTypes) {
    // TODO: Implement incremental sync for each resource type
    logger.info('sync', \`Incremental sync for \${resourceType} since \${since.toISOString()}...\`);

    // Placeholder result - replace with actual sync implementation
    const syncResult = failedSyncResult(\`Incremental sync not implemented for \${resourceType}\`);
    results.push(syncResult);
  }

  const merged = mergeSyncResults(results);
  merged.durationMs = timer.elapsed();

  logger.syncCompleted(merged);
  return merged;
}
`;
}

function getIndexTemplate(name: string, pascalName: string): string {
  const camelName = toCamelCase(name);
  const upperName = name.replace(/-/g, '_').toUpperCase();

  return `/**
 * ${pascalName} Connector
 *
 * Implements the connector interface for ${pascalName} integration.
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
  validate${pascalName}Config,
} from './client.ts';
import { normalize${pascalName}Entity } from './normalization.ts';
import {
  extractEntities,
  extractEntity,
  parseWebhookEvent,
  verifyWebhook,
} from './webhooks.ts';
import { fullSync, incrementalSync } from './sync/index.ts';
import {
  ${upperName}_COLLECTION_KEYS,
  type ${pascalName}ResourceType,
} from './types.ts';

// =============================================================================
// Supported Resources
// =============================================================================

const SUPPORTED_RESOURCES: SupportedResource[] = [
  {
    resourceType: 'contact',
    collectionKey: ${upperName}_COLLECTION_KEYS.contact,
    description: '${pascalName} contacts',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  {
    resourceType: 'company',
    collectionKey: ${upperName}_COLLECTION_KEYS.company,
    description: '${pascalName} companies',
    supportsIncrementalSync: true,
    supportsWebhooks: true,
  },
  // Add more resources as needed
];

// =============================================================================
// Migration Files
// =============================================================================

const MIGRATION_FILES = [
  '001_views.sql',
];

// =============================================================================
// Connector Metadata
// =============================================================================

const metadata: ConnectorMetadata = {
  name: CONNECTOR_NAME,
  displayName: '${pascalName}',
  version: CONNECTOR_VERSION,
  apiVersion: DEFAULT_API_VERSION,
  supportedResources: SUPPORTED_RESOURCES,
  description: 'Syncs contacts and companies from ${pascalName}',
  migrations: MIGRATION_FILES,
};

// =============================================================================
// Connector Implementation
// =============================================================================

const ${camelName}Connector: IncrementalConnector & ValidatableConnector = {
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
    return normalize${pascalName}Entity(resourceType as ${pascalName}ResourceType, data, config);
  },

  fullSync,
  incrementalSync,

  validateConfig(appConfig: AppConfig): ConfigValidationResult {
    return validate${pascalName}Config(appConfig);
  },
};

// =============================================================================
// Registration
// =============================================================================

registerConnector(CONNECTOR_NAME, () => ${camelName}Connector);

export default ${camelName}Connector;
export { metadata, ${camelName}Connector };

export * from './client.ts';
export * from './normalization.ts';
export * from './webhooks.ts';
export * from './types.ts';
`;
}

function getMigrationTemplate(name: string, pascalName: string): string {
  return `-- ${pascalName} Connector Views
-- These views provide easy access to ${name} data

-- TODO: Add views for your resource types
-- Example:

-- CREATE OR REPLACE VIEW supasaasy.${name}_contacts AS
-- SELECT
--   id,
--   external_id,
--   app_key,
--   raw_payload->>'email' AS email,
--   raw_payload->>'firstName' AS first_name,
--   raw_payload->>'lastName' AS last_name,
--   created_at,
--   updated_at,
--   archived_at
-- FROM supasaasy.entities
-- WHERE collection_key = '${name}_contact';

-- CREATE OR REPLACE VIEW supasaasy.${name}_companies AS
-- SELECT
--   id,
--   external_id,
--   app_key,
--   raw_payload->>'name' AS name,
--   raw_payload->>'domain' AS domain,
--   created_at,
--   updated_at,
--   archived_at
-- FROM supasaasy.entities
-- WHERE collection_key = '${name}_company';
`;
}

function getTestMocksTemplate(name: string, pascalName: string): string {
  return `/**
 * ${pascalName} Mock Data Generators
 *
 * Creates mock API response data for testing.
 */

import type { ${pascalName}ResourceType } from '../types.ts';

// =============================================================================
// Timestamp Helpers
// =============================================================================

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function pastTimestamp(daysAgo: number): number {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return Math.floor(date.getTime() / 1000);
}

// =============================================================================
// Mock Data Generators
// =============================================================================

export interface MockContactOptions {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  created?: number;
}

export function createMockContact(options: MockContactOptions = {}): Record<string, unknown> {
  const {
    id = \`contact_\${randomId()}\`,
    email = 'test@example.com',
    firstName = 'Test',
    lastName = 'Contact',
    created = nowTimestamp(),
  } = options;

  return {
    id,
    email,
    firstName,
    lastName,
    created,
  };
}

export interface MockCompanyOptions {
  id?: string;
  name?: string;
  domain?: string;
  created?: number;
}

export function createMockCompany(options: MockCompanyOptions = {}): Record<string, unknown> {
  const {
    id = \`company_\${randomId()}\`,
    name = 'Test Company',
    domain = 'example.com',
    created = nowTimestamp(),
  } = options;

  return {
    id,
    name,
    domain,
    created,
  };
}

// =============================================================================
// App Config Mock
// =============================================================================

export interface Mock${pascalName}AppConfigOptions {
  appKey?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  webhookSecret?: string;
  webhookSecretEnv?: string;
  syncResources?: ${pascalName}ResourceType[];
  syncFrom?: string;
}

export function createMock${pascalName}AppConfig(options: Mock${pascalName}AppConfigOptions = {}) {
  const {
    appKey = '${name}_test',
    apiKey,
    apiKeyEnv,
    webhookSecret,
    webhookSecretEnv,
    syncResources,
    syncFrom,
  } = options;

  const defaultApiKey = !apiKeyEnv ? (apiKey ?? 'test_api_key') : undefined;
  const defaultWebhookSecret = !webhookSecretEnv ? (webhookSecret ?? 'test_webhook_secret') : undefined;

  return {
    app_key: appKey,
    name: '${pascalName} Test',
    connector: '${name}',
    config: {
      ...(defaultApiKey && { api_key: defaultApiKey }),
      ...(apiKeyEnv && { api_key_env: apiKeyEnv }),
      ...(defaultWebhookSecret && { webhook_secret: defaultWebhookSecret }),
      ...(webhookSecretEnv && { webhook_secret_env: webhookSecretEnv }),
      ...(syncResources && { sync_resources: syncResources }),
      ...(syncFrom && { sync_from: syncFrom }),
    },
    ...(syncFrom && { sync_from: syncFrom }),
  };
}

// =============================================================================
// Utility Helpers
// =============================================================================

function randomId(length = 14): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
`;
}

function getTestTemplate(name: string, pascalName: string): string {
  // Use camelCase for variable names to handle hyphenated connector names
  const camelName = toCamelCase(name);
  const upperName = name.replace(/-/g, '_').toUpperCase();

  return `/**
 * ${pascalName} Connector Unit Tests
 */

import { assertEquals, assertExists } from '@std/assert';
import {
  createMock${pascalName}AppConfig,
  createMockContact,
} from './mocks.ts';
import {
  assertValidNormalizedEntity,
  testConnectorConformance,
} from '../../__tests__/conformance.test.ts';
import ${camelName}Connector from '../index.ts';
import { ${upperName}_COLLECTION_KEYS } from '../types.ts';

// =============================================================================
// Test Helpers
// =============================================================================

const mockAppConfig = createMock${pascalName}AppConfig();

// =============================================================================
// Conformance Suite
// =============================================================================

testConnectorConformance({
  connector: ${camelName}Connector,
  appConfig: mockAppConfig,
  mockWebhookPayload: { type: 'contact.created', data: createMockContact({ id: 'test_123' }) },
  mockRawEntityData: createMockContact({ id: 'test_123' }),
  resourceType: 'contact',
  // Skip webhook tests that need real signature verification
  skipWebhookTests: true,
  // Skip sync tests that need real API
  skipSyncTests: true,
});

// =============================================================================
// Metadata Tests
// =============================================================================

Deno.test('[${pascalName}] Metadata - has correct name', () => {
  assertEquals(${camelName}Connector.metadata.name, '${name}');
});

Deno.test('[${pascalName}] Metadata - has correct displayName', () => {
  assertEquals(${camelName}Connector.metadata.displayName, '${pascalName}');
});

Deno.test('[${pascalName}] Metadata - supports expected resources', () => {
  const resourceTypes = ${camelName}Connector.metadata.supportedResources.map((r) => r.resourceType);
  assertEquals(resourceTypes.includes('contact'), true);
  assertEquals(resourceTypes.includes('company'), true);
});

// =============================================================================
// Normalization Tests
// =============================================================================

Deno.test('[${pascalName}] Normalize - contact entity', () => {
  const contactData = createMockContact({
    id: 'contact_123',
    email: 'test@example.com',
  });

  const entity = ${camelName}Connector.normalizeEntity('contact', contactData, mockAppConfig);

  assertValidNormalizedEntity(entity);
  assertEquals(entity.externalId, 'contact_123');
  assertEquals(entity.appKey, mockAppConfig.app_key);
  assertEquals(entity.collectionKey, ${upperName}_COLLECTION_KEYS.contact);
});

// =============================================================================
// Validation Tests
// =============================================================================

Deno.test('[${pascalName}] Validation - has validateConfig method', () => {
  assertExists(${camelName}Connector.validateConfig);
  assertEquals(typeof ${camelName}Connector.validateConfig, 'function');
});

Deno.test('[${pascalName}] Validation - valid config passes validation', () => {
  Deno.env.set('TEST_${upperName}_API_KEY', 'test_key_123');

  const config = createMock${pascalName}AppConfig({
    apiKeyEnv: 'TEST_${upperName}_API_KEY',
  });

  const result = ${camelName}Connector.validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);

  Deno.env.delete('TEST_${upperName}_API_KEY');
});
`;
}

// =============================================================================
// Helpers
// =============================================================================

function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function isKebabCase(str: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(str);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = Deno.args;

  if (args.length === 0) {
    console.error('Usage: deno task new-connector <connector-name>');
    console.error('');
    console.error('Example:');
    console.error('  deno task new-connector hubspot');
    Deno.exit(1);
  }

  const name = args[0].toLowerCase();

  // Validate name
  if (!isKebabCase(name)) {
    console.error(`Error: Connector name must be kebab-case (e.g., 'hubspot', 'my-connector')`);
    console.error(`Got: '${name}'`);
    Deno.exit(1);
  }

  const connectorDir = `${CONNECTORS_DIR}/${name}`;

  // Check if connector already exists
  if (await fileExists(connectorDir)) {
    console.error(`Error: Connector '${name}' already exists at ${connectorDir}`);
    Deno.exit(1);
  }

  const pascalName = toPascalCase(name);

  console.log(`Creating new connector: ${name} (${pascalName})`);
  console.log(`Directory: ${connectorDir}`);
  console.log('');

  // Create directories
  await Deno.mkdir(`${connectorDir}/sync`, { recursive: true });
  await Deno.mkdir(`${connectorDir}/migrations`, { recursive: true });
  await Deno.mkdir(`${connectorDir}/__tests__`, { recursive: true });

  // Write files
  const files = [
    { path: `${connectorDir}/types.ts`, content: getTypesTemplate(name, pascalName) },
    { path: `${connectorDir}/client.ts`, content: getClientTemplate(name, pascalName) },
    { path: `${connectorDir}/normalization.ts`, content: getNormalizationTemplate(name, pascalName) },
    { path: `${connectorDir}/webhooks.ts`, content: getWebhooksTemplate(name, pascalName) },
    { path: `${connectorDir}/sync/index.ts`, content: getSyncIndexTemplate(name, pascalName) },
    { path: `${connectorDir}/index.ts`, content: getIndexTemplate(name, pascalName) },
    { path: `${connectorDir}/migrations/001_views.sql`, content: getMigrationTemplate(name, pascalName) },
    { path: `${connectorDir}/__tests__/mocks.ts`, content: getTestMocksTemplate(name, pascalName) },
    { path: `${connectorDir}/__tests__/${name}.test.ts`, content: getTestTemplate(name, pascalName) },
  ];

  for (const file of files) {
    await Deno.writeTextFile(file.path, file.content);
    console.log(`  Created: ${file.path}`);
  }

  console.log('');
  console.log('Connector created successfully!');
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Update ${connectorDir}/types.ts with your resource types`);
  console.log(`  2. Implement the API client in ${connectorDir}/client.ts`);
  console.log(`  3. Implement webhook verification in ${connectorDir}/webhooks.ts`);
  console.log(`  4. Implement sync logic in ${connectorDir}/sync/index.ts`);
  console.log(`  5. Add database views in ${connectorDir}/migrations/001_views.sql`);
  console.log(`  6. Run tests: deno test ${connectorDir}/__tests__/`);
}

main();
