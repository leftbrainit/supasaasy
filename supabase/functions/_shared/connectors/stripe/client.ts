/**
 * Stripe Client Module
 *
 * Handles Stripe API client creation and configuration helpers.
 */

import Stripe from 'npm:stripe@17';
import type { AppConfig } from '../../types/index.ts';
import type { ConfigValidationError, ConfigValidationResult } from '../index.ts';
import { createConnectorLogger } from '../utils.ts';
import type { StripeAppConfig, StripeResourceType } from './types.ts';

/** Valid Stripe resource types */
const VALID_RESOURCE_TYPES: StripeResourceType[] = [
  'customer',
  'product',
  'price',
  'plan',
  'subscription',
  'subscription_item',
];

// =============================================================================
// Constants
// =============================================================================

export const CONNECTOR_NAME = 'stripe';
export const CONNECTOR_VERSION = '1.0.0';
export const DEFAULT_API_VERSION = '2025-02-24.acacia';
export const DEFAULT_PAGE_SIZE = 100;

export const logger = createConnectorLogger(CONNECTOR_NAME);

// =============================================================================
// Configuration Helpers
// =============================================================================

/**
 * Get Stripe client configuration from app config
 */
export function getStripeConfig(appConfig: AppConfig): StripeAppConfig {
  return appConfig.config as StripeAppConfig;
}

/**
 * Get the Stripe API key from environment or config
 */
export function getApiKey(appConfig: AppConfig): string {
  const config = getStripeConfig(appConfig);

  // Try environment variable first
  if (config.api_key_env) {
    const apiKey = Deno.env.get(config.api_key_env);
    if (apiKey) return apiKey;
  }

  // Fall back to direct config (not recommended for production)
  if (config.api_key) {
    return config.api_key;
  }

  // Try default environment variable pattern
  const defaultEnvKey = `STRIPE_API_KEY_${appConfig.app_key.toUpperCase()}`;
  const defaultApiKey = Deno.env.get(defaultEnvKey);
  if (defaultApiKey) return defaultApiKey;

  throw new Error(`No Stripe API key found for app ${appConfig.app_key}`);
}

/**
 * Get the webhook signing secret from environment or config
 */
export function getWebhookSecret(appConfig: AppConfig): string {
  const config = getStripeConfig(appConfig);

  // Try environment variable first
  if (config.webhook_secret_env) {
    const secret = Deno.env.get(config.webhook_secret_env);
    if (secret) return secret;
  }

  // Fall back to direct config
  if (config.webhook_secret) {
    return config.webhook_secret;
  }

  // Try default environment variable pattern
  const defaultEnvKey = `STRIPE_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`;
  const defaultSecret = Deno.env.get(defaultEnvKey);
  if (defaultSecret) return defaultSecret;

  throw new Error(`No Stripe webhook secret found for app ${appConfig.app_key}`);
}

/**
 * Create a Stripe client for the given app configuration
 */
export function createStripeClient(appConfig: AppConfig): Stripe {
  const apiKey = getApiKey(appConfig);
  return new Stripe(apiKey, {
    apiVersion: DEFAULT_API_VERSION,
    typescript: true,
  });
}

/**
 * Get resource types to sync from config or defaults
 */
export function getResourceTypesToSync(appConfig: AppConfig): StripeResourceType[] {
  const config = getStripeConfig(appConfig);
  if (config.sync_resources && config.sync_resources.length > 0) {
    return config.sync_resources;
  }
  // Default to all resources except subscription_item (synced with subscriptions)
  return ['customer', 'product', 'price', 'plan', 'subscription'];
}

/**
 * Get sync_from timestamp from app config if configured.
 * Returns the timestamp as a Unix timestamp (seconds) for Stripe API.
 * sync_from can be set on the AppConfig or in the connector-specific config.
 */
export function getSyncFromTimestamp(appConfig: AppConfig): number | undefined {
  // Check AppConfig.sync_from first
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', `Invalid sync_from date in AppConfig: ${appConfig.sync_from}`);
  }

  // Check connector-specific config
  const config = getStripeConfig(appConfig);
  if (config.sync_from) {
    const date = new Date(config.sync_from);
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000);
    }
    logger.warn('config', `Invalid sync_from date in StripeAppConfig: ${config.sync_from}`);
  }

  return undefined;
}

// =============================================================================
// Configuration Validation
// =============================================================================

/**
 * Validate Stripe connector configuration.
 * Checks for required API keys, valid resource types, and date formats.
 */
export function validateStripeConfig(appConfig: AppConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const config = getStripeConfig(appConfig);

  // Validate API key configuration
  const hasApiKeyEnv = config.api_key_env && Deno.env.get(config.api_key_env);
  const hasApiKey = !!config.api_key;
  const hasDefaultApiKey = Deno.env.get(`STRIPE_API_KEY_${appConfig.app_key.toUpperCase()}`);

  if (!hasApiKeyEnv && !hasApiKey && !hasDefaultApiKey) {
    errors.push({
      field: 'api_key',
      message: 'No Stripe API key configured',
      suggestion: `Set ${config.api_key_env || `STRIPE_API_KEY_${appConfig.app_key.toUpperCase()}`} environment variable or configure api_key_env`,
    });
  }

  // Validate webhook secret (only warn, as it's only required for webhook handling)
  const hasWebhookSecretEnv = config.webhook_secret_env && Deno.env.get(config.webhook_secret_env);
  const hasWebhookSecret = !!config.webhook_secret;
  const hasDefaultWebhookSecret = Deno.env.get(`STRIPE_WEBHOOK_SECRET_${appConfig.app_key.toUpperCase()}`);

  if (!hasWebhookSecretEnv && !hasWebhookSecret && !hasDefaultWebhookSecret) {
    // This is a warning, not an error - webhooks are optional
    logger.warn(
      'config',
      `No webhook secret configured for ${appConfig.app_key}. Webhook verification will fail.`,
    );
  }

  // Validate sync_resources if provided
  if (config.sync_resources && config.sync_resources.length > 0) {
    for (const resource of config.sync_resources) {
      if (!VALID_RESOURCE_TYPES.includes(resource)) {
        errors.push({
          field: 'sync_resources',
          message: `Invalid resource type: ${resource}`,
          suggestion: `Valid types are: ${VALID_RESOURCE_TYPES.join(', ')}`,
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
        message: `Invalid date format: ${config.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  // Also check AppConfig.sync_from
  if (appConfig.sync_from) {
    const date = typeof appConfig.sync_from === 'string'
      ? new Date(appConfig.sync_from)
      : appConfig.sync_from;

    if (isNaN(date.getTime())) {
      errors.push({
        field: 'sync_from',
        message: `Invalid date format in AppConfig: ${appConfig.sync_from}`,
        suggestion: 'Use ISO 8601 format, e.g., "2024-01-01T00:00:00Z"',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
