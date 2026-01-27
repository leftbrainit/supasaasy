/**
 * SupaSaaSy Core Types
 *
 * This module exports all shared type definitions used across Edge Functions.
 */

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
 * Configuration for periodic sync schedules
 */
export interface SyncSchedule {
  /** App key to sync */
  app_key: string;
  /** Cron expression for sync schedule */
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

/**
 * Webhook event payload structure
 */
export interface WebhookPayload {
  /** The raw event type from the provider */
  type: string;
  /** The raw payload data */
  data: unknown;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Normalized sync record to be stored in the database
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

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean;
  /** Number of records processed */
  processed: number;
  /** Number of records that failed */
  failed: number;
  /** Error messages if any */
  errors?: string[];
}
