/**
 * Configuration Loader Unit Tests
 *
 * Tests for the configuration loading functionality:
 * - getConfig throws when not loaded
 * - clearConfigCache resets state
 */

import { assertThrows } from '@std/assert';
import { clearConfigCache, getConfig } from './config.ts';

// =============================================================================
// Test Setup
// =============================================================================

/**
 * Reset config state before each test
 */
function resetConfig(): void {
  clearConfigCache();
}

// =============================================================================
// getConfig Tests
// =============================================================================

Deno.test('[Config] getConfig - throws when config not loaded', () => {
  resetConfig();

  assertThrows(
    () => getConfig(),
    Error,
    'Configuration not loaded',
  );
});

// =============================================================================
// clearConfigCache Tests
// =============================================================================

Deno.test('[Config] clearConfigCache - can be called multiple times safely', () => {
  // Should not throw even when called multiple times
  clearConfigCache();
  clearConfigCache();
  clearConfigCache();

  // Should still throw on getConfig after clearing
  assertThrows(
    () => getConfig(),
    Error,
    'Configuration not loaded',
  );
});

// =============================================================================
// Note: loadConfig tests require mocking the import
// =============================================================================

// The loadConfig function dynamically imports the config file,
// which is difficult to test without integration tests.
// These tests focus on the synchronous functions that can be unit tested.
