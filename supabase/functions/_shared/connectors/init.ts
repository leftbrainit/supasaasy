/**
 * Connector Initialization
 *
 * Imports and registers all available connectors.
 * This module should be imported at the start of Edge Functions
 * to ensure connectors are registered before use.
 */

// Import all connector modules to trigger their self-registration
import './stripe/index.ts';

// Re-export main connector functions for convenience
export {
  type Connector,
  getAppConfig,
  getConnector,
  getConnectorForAppKey,
  type IncrementalConnector,
  type IncrementalSyncHandler,
  listConnectorMetadata,
  listConnectors,
  registerConnector,
  supportsIncrementalSync,
  type SyncHandler,
  type WebhookHandler,
} from './index.ts';

/**
 * Initialize all connectors.
 * Call this function at the start of Edge Functions to ensure
 * all connectors are registered.
 *
 * This is automatically done when this module is imported.
 */
export function initializeConnectors(): void {
  // Connectors are registered via their module imports above
  console.log('Connectors initialized');
}
