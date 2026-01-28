/**
 * Configuration Loader Unit Tests
 *
 * Tests for the configuration loading functionality:
 * - getConfig throws when not loaded
 * - clearConfig resets state
 */

import { assertThrows } from '@std/assert';
import { clearConfig, getConfig } from '../connectors/index.ts';

// =============================================================================
// Test Setup
// =============================================================================

/**
 * Reset config state before each test
 */
function resetConfig(): void {
  clearConfig();
}

// =============================================================================
// getConfig Tests
// =============================================================================

Deno.test('[Config] getConfig - throws when config not loaded', () => {
  resetConfig();

  assertThrows(
    () => getConfig(),
    Error,
    'Configuration not set',
  );
});

// =============================================================================
// clearConfig Tests
// =============================================================================

Deno.test('[Config] clearConfig - can be called multiple times safely', () => {
  // Should not throw even when called multiple times
  clearConfig();
  clearConfig();
  clearConfig();

  // Should still throw on getConfig after clearing
  assertThrows(
    () => getConfig(),
    Error,
    'Configuration not set',
  );
});

// =============================================================================
// Note: loadConfig tests require mocking the import
// =============================================================================

// The setConfig function sets the configuration,
// which is tested through integration tests.
// These tests focus on the synchronous functions that can be unit tested.
