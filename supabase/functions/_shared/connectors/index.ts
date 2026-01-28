/**
 * Connector Registry
 *
 * Central registry for all connector implementations.
 * Connectors are loaded dynamically based on the app configuration.
 */

import type {
  AppConfig,
  ConnectorMetadata,
  NormalizedEntity,
  ParsedWebhookEvent,
  SyncOptions,
  SyncResult,
  WebhookVerificationResult,
} from '../types/index.ts';
import { getConfig } from '../config.ts';

// =============================================================================
// Connector Interfaces
// =============================================================================

/**
 * Webhook handler interface for processing incoming webhooks
 */
export interface WebhookHandler {
  /**
   * Verify the authenticity of an incoming webhook request
   * @param request The raw HTTP request
   * @param config The app configuration
   * @returns Verification result with parsed payload if valid
   */
  verifyWebhook(
    request: Request,
    config: AppConfig
  ): Promise<WebhookVerificationResult>;

  /**
   * Parse a verified webhook payload into a normalized event
   * @param payload The verified webhook payload
   * @param config The app configuration
   * @returns Parsed webhook event
   */
  parseWebhookEvent(
    payload: unknown,
    config: AppConfig
  ): Promise<ParsedWebhookEvent>;

  /**
   * Extract and normalize entity data from a webhook event
   * @param event The parsed webhook event
   * @param config The app configuration
   * @returns Normalized entity ready for database storage
   */
  extractEntity(
    event: ParsedWebhookEvent,
    config: AppConfig
  ): Promise<NormalizedEntity | null>;

  /**
   * Extract and normalize multiple entities from a webhook event.
   * Used for events that contain nested resources (e.g., subscription with items).
   * If not implemented, falls back to extractEntity returning a single entity.
   * @param event The parsed webhook event
   * @param config The app configuration
   * @returns Array of normalized entities ready for database storage
   */
  extractEntities?(
    event: ParsedWebhookEvent,
    config: AppConfig
  ): Promise<NormalizedEntity[]>;
}

/**
 * Sync handler interface for full synchronization
 */
export interface SyncHandler {
  /**
   * Perform a full sync of all configured resources
   * @param config The app configuration
   * @param options Sync options (pagination, filters)
   * @returns Sync result with counts
   */
  fullSync(config: AppConfig, options?: SyncOptions): Promise<SyncResult>;
}

/**
 * Incremental sync handler interface for delta synchronization
 */
export interface IncrementalSyncHandler {
  /**
   * Perform an incremental sync of resources modified since last sync
   * @param config The app configuration
   * @param since Timestamp of last successful sync
   * @param options Additional sync options
   * @returns Sync result with counts
   */
  incrementalSync(
    config: AppConfig,
    since: Date,
    options?: SyncOptions
  ): Promise<SyncResult>;
}

/**
 * Complete connector interface that all connectors must implement
 */
export interface Connector extends WebhookHandler, SyncHandler {
  /** Connector metadata describing capabilities */
  readonly metadata: ConnectorMetadata;

  /**
   * Normalize a raw API response to the canonical entity format
   * @param resourceType The resource type being normalized
   * @param data The raw API response data
   * @param config The app configuration
   * @returns Normalized entity
   */
  normalizeEntity(
    resourceType: string,
    data: Record<string, unknown>,
    config: AppConfig
  ): NormalizedEntity;
}

/**
 * Connector with incremental sync support
 */
export interface IncrementalConnector extends Connector, IncrementalSyncHandler {}

/**
 * Type guard to check if a connector supports incremental sync
 */
export function supportsIncrementalSync(
  connector: Connector
): connector is IncrementalConnector {
  return 'incrementalSync' in connector;
}

// =============================================================================
// Connector Registry
// =============================================================================

/**
 * Connector factory function type
 */
type ConnectorFactory = () => Connector | Promise<Connector>;

// Registry of available connectors (name -> factory)
const connectorRegistry = new Map<string, ConnectorFactory>();

// Cache of instantiated connectors
const connectorCache = new Map<string, Connector>();

/**
 * Register a connector with the registry
 * @param name Unique connector name (must match metadata.name)
 * @param factory Factory function that creates the connector
 */
export function registerConnector(
  name: string,
  factory: ConnectorFactory
): void {
  if (connectorRegistry.has(name)) {
    console.warn(`Connector '${name}' is already registered, overwriting`);
  }
  connectorRegistry.set(name, factory);
  // Clear cache when re-registering
  connectorCache.delete(name);
}

/**
 * Get a connector by provider name
 * @param name The connector/provider name (e.g., 'stripe')
 * @returns The connector instance or undefined if not found
 */
export async function getConnector(name: string): Promise<Connector | undefined> {
  // Check cache first
  const cached = connectorCache.get(name);
  if (cached) {
    return cached;
  }

  // Get factory and create instance
  const factory = connectorRegistry.get(name);
  if (!factory) {
    return undefined;
  }

  const connector = await factory();
  connectorCache.set(name, connector);
  return connector;
}

/**
 * Get a connector for a specific app_key by looking up the configuration
 * @param appKey The app_key from the webhook URL or sync request
 * @returns The connector instance or undefined if not found
 */
export async function getConnectorForAppKey(
  appKey: string
): Promise<Connector | undefined> {
  const config = getConfig();
  const appConfig = config.apps.find((app) => app.app_key === appKey);

  if (!appConfig) {
    console.error(`No app configuration found for app_key: ${appKey}`);
    return undefined;
  }

  const connector = await getConnector(appConfig.connector);
  if (!connector) {
    console.error(
      `No connector registered for provider: ${appConfig.connector}`
    );
    return undefined;
  }

  return connector;
}

/**
 * Get the app configuration for a given app_key
 * @param appKey The app_key to look up
 * @returns The app configuration or undefined if not found
 */
export function getAppConfig(appKey: string): AppConfig | undefined {
  const config = getConfig();
  return config.apps.find((app) => app.app_key === appKey);
}

/**
 * List all registered connector names
 * @returns Array of registered connector names
 */
export function listConnectors(): string[] {
  return Array.from(connectorRegistry.keys());
}

/**
 * Get metadata for all registered connectors
 * @returns Array of connector metadata
 */
export async function listConnectorMetadata(): Promise<ConnectorMetadata[]> {
  const metadata: ConnectorMetadata[] = [];
  for (const name of connectorRegistry.keys()) {
    const connector = await getConnector(name);
    if (connector) {
      metadata.push(connector.metadata);
    }
  }
  return metadata;
}

/**
 * Clear the connector cache (useful for testing)
 */
export function clearConnectorCache(): void {
  connectorCache.clear();
}

/**
 * Unregister all connectors (useful for testing)
 */
export function clearConnectorRegistry(): void {
  connectorRegistry.clear();
  connectorCache.clear();
}
