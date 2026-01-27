/**
 * Configuration Loader
 *
 * Loads and validates SupaSaaSy configuration at runtime.
 */

import type { SupaSaaSyConfig, AppConfig } from './types/index.ts';

let cachedConfig: SupaSaaSyConfig | null = null;

/**
 * Load configuration from the config file
 * In production, this reads from the deployed configuration
 */
export async function loadConfig(): Promise<SupaSaaSyConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // In Edge Functions, config is typically loaded via environment or import
  // This will be populated during deployment
  const configModule = await import('../../../config/supasaasy.config.ts');
  cachedConfig = configModule.default as SupaSaaSyConfig;

  return cachedConfig;
}

/**
 * Get configuration for a specific app by its key
 */
export async function getAppConfig(appKey: string): Promise<AppConfig | undefined> {
  const config = await loadConfig();
  return config.apps.find((app) => app.app_key === appKey);
}

/**
 * Clear the cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
