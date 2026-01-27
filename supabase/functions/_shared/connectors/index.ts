/**
 * Connector Registry
 *
 * Central registry for all connector implementations.
 * Connectors are loaded dynamically based on the app configuration.
 */

import type { AppConfig, WebhookPayload, SyncResult } from '../types/index.ts';

/**
 * Base interface that all connectors must implement
 */
export interface Connector {
  /** Unique identifier for this connector type */
  readonly name: string;

  /**
   * Verify the authenticity of an incoming webhook
   * @param request The incoming HTTP request
   * @param config The app configuration
   * @returns true if the webhook is valid
   */
  verifyWebhook(request: Request, config: AppConfig): Promise<boolean>;

  /**
   * Process a webhook event and return normalized records
   * @param payload The webhook payload
   * @param config The app configuration
   * @returns Sync result with processed records
   */
  processWebhook(payload: WebhookPayload, config: AppConfig): Promise<SyncResult>;

  /**
   * Perform a full or incremental sync
   * @param config The app configuration
   * @param since Optional timestamp for incremental sync
   * @returns Sync result with processed records
   */
  sync(config: AppConfig, since?: Date): Promise<SyncResult>;
}

// Registry of available connectors
const connectorRegistry = new Map<string, () => Promise<Connector>>();

/**
 * Register a connector factory
 */
export function registerConnector(name: string, factory: () => Promise<Connector>): void {
  connectorRegistry.set(name, factory);
}

/**
 * Get a connector by name
 */
export async function getConnector(name: string): Promise<Connector | undefined> {
  const factory = connectorRegistry.get(name);
  if (!factory) {
    return undefined;
  }
  return await factory();
}

/**
 * List all registered connector names
 */
export function listConnectors(): string[] {
  return Array.from(connectorRegistry.keys());
}
