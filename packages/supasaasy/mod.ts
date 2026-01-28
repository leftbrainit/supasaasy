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
  defineConfig,
  validateConfig,
  type ConfigValidationError,
  type ConfigValidationResult,
  type DefineConfigOptions,
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
  getMigrations,
  getCoreSchema,
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
  getSupabaseClient,
  query,
  resetClient,
  upsertEntity,
  upsertEntities,
  deleteEntity,
  deleteEntities,
  getEntity,
  getEntityExternalIds,
  getEntityExternalIdsCreatedAfter,
  getSyncState,
  updateSyncState,
  getSyncStates,
  type Entity,
  type UpsertEntityData,
  type UpsertResult,
  type DeleteResult,
  type SyncState,
} from './src/db/index.ts';

// =============================================================================
// Connector Registry & Interfaces
// =============================================================================

export {
  registerConnector,
  getConnector,
  getConnectorForAppKey,
  getAppConfig,
  listConnectors,
  listConnectorMetadata,
  setConfig,
  getConfig,
  clearConfig,
  clearConnectorCache,
  clearConnectorRegistry,
  supportsIncrementalSync,
  supportsConfigValidation,
  validateConnectorConfig,
  type Connector,
  type IncrementalConnector,
  type ValidatableConnector,
  type WebhookHandler,
  type SyncHandler,
  type IncrementalSyncHandler,
  type ConfigValidator,
  type ConfigValidationError as ConnectorConfigValidationError,
  type ConfigValidationResult as ConnectorConfigValidationResult,
} from './src/connectors/index.ts';

// =============================================================================
// Connector Error Types
// =============================================================================

export {
  ConnectorError,
  WebhookVerificationError,
  RateLimitError,
  ApiError,
  EntityNotFoundError,
  NormalizationError,
  ConfigurationError,
  isConnectorError,
  isRetryableError,
  getRetryAfterSeconds,
} from './src/connectors/errors.ts';

// =============================================================================
// Connector Utilities
// =============================================================================

export {
  entityToRow,
  rowToEntity,
  createNormalizedEntity,
  buildCollectionKey,
  getCollectionKey,
  detectArchivedAt,
  extractExternalId,
  emptySyncResult,
  failedSyncResult,
  mergeSyncResults,
  paginatedSync,
  createConnectorLogger,
  createTimer,
  type PaginatedResponse,
  type PaginatedSyncConfig,
  type SyncProgressInfo,
  type LogLevel,
  type LogEntry,
} from './src/connectors/utils.ts';

// =============================================================================
// Built-in Connectors
// =============================================================================

// Stripe Connector
export { stripeConnector, metadata as stripeMetadata } from './src/connectors/stripe/index.ts';
export type { StripeResourceType, StripeAppConfig } from './src/connectors/stripe/types.ts';

// Intercom Connector
export { intercomConnector, metadata as intercomMetadata } from './src/connectors/intercom/index.ts';
export type { IntercomResourceType, IntercomAppConfig } from './src/connectors/intercom/types.ts';
