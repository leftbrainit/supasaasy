/**
 * SupaSaaSy Core Types
 *
 * This module exports all shared type definitions used across Edge Functions.
 */

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for a single app instance
 */
export interface AppConfig {
  /** Unique identifier for this app instance (used in webhook URLs) */
  app_key: string;
  /** Human-readable name for this app instance */
  name: string;
  /** The connector type (e.g., 'stripe', 'shopify') */
  connector: string;
  /** Connector-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Configuration for periodic sync schedules.
 *
 * The schedule uses standard cron expression format:
 *   ┌───────── minute (0 - 59)
 *   │ ┌───────── hour (0 - 23)
 *   │ │ ┌───────── day of month (1 - 31)
 *   │ │ │ ┌───────── month (1 - 12)
 *   │ │ │ │ ┌───────── day of week (0 - 6) (Sunday to Saturday)
 *   │ │ │ │ │
 *   * * * * *
 *
 * Examples:
 *   - "0 * * * *"    - Every hour at minute 0
 *   - "*/15 * * * *" - Every 15 minutes
 *   - "0 0 * * *"    - Daily at midnight
 *   - "0 2 * * 0"    - Weekly on Sunday at 2 AM
 */
export interface SyncSchedule {
  /** App key to sync */
  app_key: string;
  /** Cron expression for sync schedule (see interface comment for format) */
  cron: string;
  /** Whether this schedule is enabled */
  enabled: boolean;
}

/**
 * Root configuration for SupaSaaSy
 */
export interface SupaSaaSyConfig {
  /** List of configured app instances */
  apps: AppConfig[];
  /** Periodic sync schedules */
  sync_schedules?: SyncSchedule[];
}

// =============================================================================
// Connector Metadata Types
// =============================================================================

/**
 * Describes a single resource type that a connector can sync
 */
export interface SupportedResource {
  /** The resource type name from the SaaS API (e.g., 'customer', 'subscription') */
  resourceType: string;
  /** The collection_key used in the entities table (e.g., 'stripe_customer') */
  collectionKey: string;
  /** Human-readable description of this resource */
  description?: string;
  /** Whether this resource supports incremental sync */
  supportsIncrementalSync: boolean;
  /** Whether this resource can be synced via webhooks */
  supportsWebhooks: boolean;
}

/**
 * Metadata describing a connector's capabilities
 */
export interface ConnectorMetadata {
  /** Unique provider name (e.g., 'stripe', 'intercom') */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Version of the connector implementation */
  version: string;
  /** Target API version this connector is built for */
  apiVersion: string;
  /** List of supported resources */
  supportedResources: SupportedResource[];
  /** Description of the connector */
  description?: string;
}

// =============================================================================
// Entity Types (matching entities table schema)
// =============================================================================

/**
 * Normalized entity matching the supasaasy.entities table schema
 */
export interface NormalizedEntity {
  /** External provider's ID for this entity */
  externalId: string;
  /** App instance identifier (e.g., 'stripe_production') */
  appKey: string;
  /** Collection/resource type (e.g., 'stripe_customer') */
  collectionKey: string;
  /** Upstream API version */
  apiVersion?: string;
  /** Complete API response as JSON */
  rawPayload: Record<string, unknown>;
  /** Timestamp when entity was soft-deleted upstream */
  archivedAt?: Date;
}

/**
 * Database row representation of an entity (snake_case for SQL)
 */
export interface EntityRow {
  id?: string;
  external_id: string;
  app_key: string;
  collection_key: string;
  api_version?: string;
  raw_payload: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
  deleted_at?: string | null;
}

// =============================================================================
// Webhook Types
// =============================================================================

/**
 * Standard webhook event types
 */
export type WebhookEventType = 'create' | 'update' | 'delete' | 'archive';

/**
 * Result of webhook signature verification
 */
export interface WebhookVerificationResult {
  /** Whether the verification succeeded */
  valid: boolean;
  /** Reason for failure if not valid */
  reason?: string;
  /** Parsed payload if verification succeeded */
  payload?: unknown;
}

/**
 * Parsed and normalized webhook event
 */
export interface ParsedWebhookEvent {
  /** The normalized event type */
  eventType: WebhookEventType;
  /** The original event type from the provider */
  originalEventType: string;
  /** The resource type this event relates to */
  resourceType: string;
  /** The external ID of the affected entity */
  externalId: string;
  /** The entity data (may be partial for updates) */
  data: Record<string, unknown>;
  /** Timestamp of the event */
  timestamp: Date;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Legacy webhook payload structure (kept for backwards compatibility)
 */
export interface WebhookPayload {
  /** The raw event type from the provider */
  type: string;
  /** The raw payload data */
  data: unknown;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Options for sync operations
 */
export interface SyncOptions {
  /** Maximum number of records to fetch per page */
  pageSize?: number;
  /** Cursor or page token for pagination */
  cursor?: string;
  /** Timestamp for incremental sync (fetch only records modified since) */
  since?: Date;
  /** Specific resource types to sync (empty = all) */
  resourceTypes?: string[];
  /** Maximum total records to sync (for testing/debugging) */
  limit?: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync completed without fatal errors */
  success: boolean;
  /** Number of records created */
  created: number;
  /** Number of records updated */
  updated: number;
  /** Number of records deleted/archived */
  deleted: number;
  /** Number of records that failed to process */
  errors: number;
  /** Error messages if any */
  errorMessages?: string[];
  /** Cursor for next page if pagination is incomplete */
  nextCursor?: string;
  /** Whether there are more records to fetch */
  hasMore?: boolean;
  /** Duration of the sync operation in milliseconds */
  durationMs?: number;
}

/**
 * Legacy sync record type (kept for backwards compatibility)
 */
export interface SyncRecord {
  /** The supasaasy app key */
  app_key: string;
  /** External provider's ID for this record */
  external_id: string;
  /** The object type (e.g., 'customer', 'subscription') */
  object_type: string;
  /** The normalized data payload */
  data: Record<string, unknown>;
  /** Provider-specific raw data */
  raw_data?: unknown;
  /** Timestamp of the external event */
  external_updated_at?: string;
}
