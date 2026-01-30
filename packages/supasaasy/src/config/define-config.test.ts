/**
 * Define Config Unit Tests
 *
 * Tests for configuration validation:
 * - App config validation
 * - Sync schedule validation
 * - Webhook logging validation
 * - Auth config validation
 */

import { assertEquals, assertThrows } from '@std/assert';
import { defineConfig, validateConfig } from './define-config.ts';
import type { SupaSaaSyConfig } from '../types/index.ts';

// =============================================================================
// Test Helpers
// =============================================================================

function validConfig(): SupaSaaSyConfig {
  return {
    apps: [
      {
        app_key: 'test_app',
        name: 'Test App',
        connector: 'stripe',
        config: {
          api_key_env: 'STRIPE_API_KEY',
        },
      },
    ],
  };
}

// =============================================================================
// Auth Config Validation Tests
// =============================================================================

Deno.test('[DefineConfig] auth - accepts valid auth config with enabled: true', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    auth: { enabled: true },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('[DefineConfig] auth - accepts valid auth config with enabled: false', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    auth: { enabled: false },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('[DefineConfig] auth - accepts config without auth (defaults to enabled)', () => {
  const config = validConfig();

  const result = validateConfig(config);

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test('[DefineConfig] auth - rejects non-object auth', () => {
  const config = {
    ...validConfig(),
    auth: 'invalid' as unknown as { enabled: boolean },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].path, 'auth');
  assertEquals(result.errors[0].message, 'auth must be an object');
});

Deno.test('[DefineConfig] auth - rejects null auth', () => {
  const config = {
    ...validConfig(),
    auth: null as unknown as { enabled: boolean },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].path, 'auth');
});

Deno.test('[DefineConfig] auth - rejects auth without enabled property', () => {
  const config = {
    ...validConfig(),
    auth: {} as unknown as { enabled: boolean },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].path, 'auth.enabled');
  assertEquals(result.errors[0].message, 'enabled is required and must be a boolean');
});

Deno.test('[DefineConfig] auth - rejects non-boolean enabled', () => {
  const config = {
    ...validConfig(),
    auth: { enabled: 'true' } as unknown as { enabled: boolean },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].path, 'auth.enabled');
});

// =============================================================================
// defineConfig Integration Tests
// =============================================================================

Deno.test('[DefineConfig] defineConfig - returns config when valid', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    auth: { enabled: true },
  };

  const result = defineConfig(config);

  assertEquals(result, config);
});

Deno.test('[DefineConfig] defineConfig - throws on invalid auth config', () => {
  const config = {
    ...validConfig(),
    auth: { enabled: 'invalid' } as unknown as { enabled: boolean },
  };

  assertThrows(
    () => defineConfig(config),
    Error,
    'Invalid SupaSaaSy configuration',
  );
});

Deno.test('[DefineConfig] defineConfig - skips validation when validate: false', () => {
  const config = {
    ...validConfig(),
    auth: { enabled: 'invalid' } as unknown as { enabled: boolean },
  };

  // Should not throw when validation is disabled
  const result = defineConfig(config, { validate: false });

  assertEquals(result, config);
});

// =============================================================================
// Webhook Logging Validation Tests (existing tests for completeness)
// =============================================================================

Deno.test('[DefineConfig] webhook_logging - accepts valid config', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    webhook_logging: { enabled: true },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test('[DefineConfig] webhook_logging - rejects invalid enabled', () => {
  const config = {
    ...validConfig(),
    webhook_logging: { enabled: 'true' } as unknown as { enabled: boolean },
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors[0].path, 'webhook_logging.enabled');
});

// =============================================================================
// App Config Validation Tests
// =============================================================================

Deno.test('[DefineConfig] app - rejects invalid app_key format', () => {
  const config: SupaSaaSyConfig = {
    apps: [
      {
        app_key: 'Invalid-Key',
        name: 'Test',
        connector: 'stripe',
        config: {},
      },
    ],
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.path.includes('app_key')), true);
});

Deno.test('[DefineConfig] app - rejects duplicate app_keys', () => {
  const config: SupaSaaSyConfig = {
    apps: [
      { app_key: 'duplicate_key', name: 'Test 1', connector: 'stripe', config: {} },
      { app_key: 'duplicate_key', name: 'Test 2', connector: 'stripe', config: {} },
    ],
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.message.includes('Duplicate')), true);
});

// =============================================================================
// Sync Schedule Validation Tests
// =============================================================================

Deno.test('[DefineConfig] sync_schedules - accepts valid schedule', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    sync_schedules: [
      { app_key: 'test_app', cron: '0 * * * *', enabled: true },
    ],
  };

  const result = validateConfig(config);

  assertEquals(result.valid, true);
});

Deno.test('[DefineConfig] sync_schedules - rejects invalid app_key reference', () => {
  const config: SupaSaaSyConfig = {
    ...validConfig(),
    sync_schedules: [
      { app_key: 'nonexistent_app', cron: '0 * * * *', enabled: true },
    ],
  };

  const result = validateConfig(config);

  assertEquals(result.valid, false);
  assertEquals(result.errors[0].message.includes('does not match'), true);
});
