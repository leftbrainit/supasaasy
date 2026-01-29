/**
 * Configuration Helper
 *
 * Provides type-safe configuration definition with optional runtime validation.
 */

import type { AppConfig, SupaSaaSyConfig } from '../types/index.ts';

// =============================================================================
// Validation Types
// =============================================================================

export interface ConfigValidationError {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate app configuration
 */
function validateAppConfig(app: AppConfig, index: number): ConfigValidationError[] {
  const errors: ConfigValidationError[] = [];
  const path = `apps[${index}]`;

  if (!app.app_key || typeof app.app_key !== 'string') {
    errors.push({
      path: `${path}.app_key`,
      message: 'app_key is required and must be a string',
    });
  } else if (!/^[a-z0-9_]+$/.test(app.app_key)) {
    errors.push({
      path: `${path}.app_key`,
      message: 'app_key must contain only lowercase letters, numbers, and underscores',
    });
  }

  if (!app.name || typeof app.name !== 'string') {
    errors.push({
      path: `${path}.name`,
      message: 'name is required and must be a string',
    });
  }

  if (!app.connector || typeof app.connector !== 'string') {
    errors.push({
      path: `${path}.connector`,
      message: 'connector is required and must be a string',
    });
  }

  if (app.config === undefined || app.config === null) {
    errors.push({
      path: `${path}.config`,
      message: 'config is required',
    });
  }

  // Validate sync_from if provided
  if (app.sync_from !== undefined) {
    const date = typeof app.sync_from === 'string' ? new Date(app.sync_from) : app.sync_from;

    if (!(date instanceof Date) || isNaN(date.getTime())) {
      errors.push({
        path: `${path}.sync_from`,
        message: 'sync_from must be a valid ISO 8601 date string or Date object',
      });
    }
  }

  return errors;
}

/**
 * Validate the complete SupaSaaSy configuration
 */
export function validateConfig(config: SupaSaaSyConfig): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];

  // Validate apps array
  if (!config.apps || !Array.isArray(config.apps)) {
    errors.push({
      path: 'apps',
      message: 'apps is required and must be an array',
    });
  } else {
    // Validate each app
    const appKeys = new Set<string>();
    config.apps.forEach((app, index) => {
      const appErrors = validateAppConfig(app, index);
      errors.push(...appErrors);

      // Check for duplicate app_keys
      if (app.app_key) {
        if (appKeys.has(app.app_key)) {
          errors.push({
            path: `apps[${index}].app_key`,
            message: `Duplicate app_key: ${app.app_key}`,
          });
        }
        appKeys.add(app.app_key);
      }
    });
  }

  // Validate sync_schedules if provided
  if (config.sync_schedules !== undefined) {
    if (!Array.isArray(config.sync_schedules)) {
      errors.push({
        path: 'sync_schedules',
        message: 'sync_schedules must be an array',
      });
    } else {
      // Get valid app_keys for schedule validation
      const validAppKeys = new Set(config.apps?.map((a) => a.app_key) ?? []);

      config.sync_schedules.forEach((schedule, index) => {
        const path = `sync_schedules[${index}]`;

        if (!schedule.app_key || typeof schedule.app_key !== 'string') {
          errors.push({
            path: `${path}.app_key`,
            message: 'app_key is required and must be a string',
          });
        } else if (!validAppKeys.has(schedule.app_key)) {
          errors.push({
            path: `${path}.app_key`,
            message: `app_key "${schedule.app_key}" does not match any configured app`,
          });
        }

        if (!schedule.cron || typeof schedule.cron !== 'string') {
          errors.push({
            path: `${path}.cron`,
            message: 'cron is required and must be a string',
          });
        }

        if (typeof schedule.enabled !== 'boolean') {
          errors.push({
            path: `${path}.enabled`,
            message: 'enabled is required and must be a boolean',
          });
        }
      });
    }
  }

  // Validate webhook_logging if provided
  if (config.webhook_logging !== undefined) {
    if (typeof config.webhook_logging !== 'object' || config.webhook_logging === null) {
      errors.push({
        path: 'webhook_logging',
        message: 'webhook_logging must be an object',
      });
    } else {
      if (typeof config.webhook_logging.enabled !== 'boolean') {
        errors.push({
          path: 'webhook_logging.enabled',
          message: 'enabled is required and must be a boolean',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Configuration Helper
// =============================================================================

/**
 * Options for defineConfig
 */
export interface DefineConfigOptions {
  /**
   * Whether to validate the configuration at runtime.
   * If true and validation fails, an error is thrown.
   * Default: true
   */
  validate?: boolean;
}

/**
 * Define and optionally validate a SupaSaaSy configuration.
 *
 * This function provides TypeScript type inference for the configuration
 * and optional runtime validation to catch configuration errors early.
 *
 * @param config The SupaSaaSy configuration
 * @param options Configuration options
 * @returns The validated configuration
 * @throws Error if validation is enabled and fails
 *
 * @example
 * ```typescript
 * import { defineConfig } from 'supasaasy';
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
 *   sync_schedules: [
 *     { app_key: 'stripe_prod', cron: '0 * /6 * * *', enabled: true },
 *   ],
 * });
 * ```
 */
export function defineConfig(
  config: SupaSaaSyConfig,
  options: DefineConfigOptions = {},
): SupaSaaSyConfig {
  const { validate = true } = options;

  if (validate) {
    const result = validateConfig(config);
    if (!result.valid) {
      const errorMessages = result.errors.map((e) => `  - ${e.path}: ${e.message}`);
      throw new Error(
        `Invalid SupaSaaSy configuration:\n${errorMessages.join('\n')}`,
      );
    }
  }

  return config;
}
