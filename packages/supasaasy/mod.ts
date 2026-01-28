/**
 * SupaSaaSy - SaaS Data Sync Library for Supabase
 *
 * @module
 *
 * This library provides a framework for syncing data from SaaS providers
 * (like Stripe, Intercom) into your Supabase database.
 *
 * ## Quick Start
 *
 * ```typescript
 * // supasaasy.config.ts
 * import { defineConfig } from '@supasaasy/core';
 *
 * export default defineConfig({
 *   apps: [
 *     {
 *       app_key: 'stripe_prod',
 *       name: 'Stripe Production',
 *       connector: 'stripe',
 *       config: {
 *         api_key_env: 'STRIPE_API_KEY',
 *         webhook_secret_env: 'STRIPE_WEBHOOK_SECRET',
 *       },
 *     },
 *   ],
 * });
 * ```
 *
 * ```typescript
 * // supabase/functions/webhook/index.ts
 * import { createWebhookHandler } from '@supasaasy/core';
 * import config from '../../../supasaasy.config.ts';
 *
 * Deno.serve(createWebhookHandler(config));
 * ```
 *
 * ```typescript
 * // supabase/functions/sync/index.ts
 * import { createSyncHandler } from '@supasaasy/core';
 * import config from '../../../supasaasy.config.ts';
 *
 * Deno.serve(createSyncHandler(config));
 * ```
 */

// =============================================================================
// Configuration API
// =============================================================================

export {
  type ConfigValidationError,
  type ConfigValidationResult,
  defineConfig,
  type DefineConfigOptions,
  validateConfig,
} from './src/config/define-config.ts';

// =============================================================================
// Handler Factory Functions
// =============================================================================

export { createWebhookHandler } from './src/handlers/webhook.ts';
export { createSyncHandler } from './src/handlers/sync.ts';

// =============================================================================
// Migration Generation
// =============================================================================

export {
  getCoreSchema,
  getMigrations,
  type GetMigrationsOptions,
} from './src/migrations/get-migrations.ts';

// =============================================================================
// Core Types
// =============================================================================

export type {
  AppConfig,
  ConnectorMetadata,
  EntityRow,
  NormalizedEntity,
  ParsedWebhookEvent,
  SupaSaaSyConfig,
  SupportedResource,
  SyncOptions,
  SyncProgress,
  SyncRecord,
  SyncResult,
  SyncSchedule,
  WebhookEventType,
  WebhookPayload,
  WebhookVerificationResult,
} from './src/types/index.ts';

// =============================================================================
// Database Utilities
// =============================================================================

export {
  deleteEntities,
  deleteEntity,
  type DeleteResult,
  type Entity,
  getEntity,
  getEntityExternalIds,
  getEntityExternalIdsCreatedAfter,
  getSupabaseClient,
  getSyncState,
  getSyncStates,
  query,
  resetClient,
  type SyncState,
  updateSyncState,
  upsertEntities,
  upsertEntity,
  type UpsertEntityData,
  type UpsertResult,
} from './src/db/index.ts';

// =============================================================================
// Connector Registry & Interfaces
// =============================================================================

export {
  clearConfig,
  clearConnectorCache,
  clearConnectorRegistry,
  type ConfigValidationError as ConnectorConfigValidationError,
  type ConfigValidationResult as ConnectorConfigValidationResult,
  type ConfigValidator,
  type Connector,
  getAppConfig,
  getConfig,
  getConnector,
  getConnectorForAppKey,
  type IncrementalConnector,
  type IncrementalSyncHandler,
  listConnectorMetadata,
  listConnectors,
  registerConnector,
  setConfig,
  supportsConfigValidation,
  supportsIncrementalSync,
  type SyncHandler,
  type ValidatableConnector,
  validateConnectorConfig,
  type WebhookHandler,
} from './src/connectors/index.ts';

// =============================================================================
// Connector Error Types
// =============================================================================

export {
  ApiError,
  ConfigurationError,
  ConnectorError,
  EntityNotFoundError,
  getRetryAfterSeconds,
  isConnectorError,
  isRetryableError,
  NormalizationError,
  RateLimitError,
  WebhookVerificationError,
} from './src/connectors/errors.ts';

// =============================================================================
// Connector Utilities
// =============================================================================

export {
  buildCollectionKey,
  createConnectorLogger,
  createNormalizedEntity,
  createTimer,
  detectArchivedAt,
  emptySyncResult,
  entityToRow,
  extractExternalId,
  failedSyncResult,
  getCollectionKey,
  type LogEntry,
  type LogLevel,
  mergeSyncResults,
  type PaginatedResponse,
  paginatedSync,
  type PaginatedSyncConfig,
  rowToEntity,
  type SyncProgressInfo,
} from './src/connectors/utils.ts';

// =============================================================================
// Built-in Connectors
// =============================================================================

// Stripe Connector
export { metadata as stripeMetadata, stripeConnector } from './src/connectors/stripe/index.ts';
export type { StripeAppConfig, StripeResourceType } from './src/connectors/stripe/types.ts';

// Intercom Connector
export {
  intercomConnector,
  metadata as intercomMetadata,
} from './src/connectors/intercom/index.ts';
export type { IntercomAppConfig, IntercomResourceType } from './src/connectors/intercom/types.ts';
