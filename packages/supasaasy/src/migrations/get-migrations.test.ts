/**
 * Migration Generation Unit Tests
 *
 * Tests for the getMigrations function:
 * - Core schema generation
 * - Auth SQL generation (enabled/disabled)
 * - Connector migration inclusion
 */

import { assertEquals } from '@std/assert';
import { getCoreSchema, getMigrations } from './get-migrations.ts';
import type { SupaSaaSyConfig } from '../types/index.ts';

// =============================================================================
// Test Helpers
// =============================================================================

function minimalConfig(): SupaSaaSyConfig {
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
// getCoreSchema Tests
// =============================================================================

Deno.test('[Migrations] getCoreSchema - includes entities table', () => {
  const sql = getCoreSchema();

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.entities'), true);
});

Deno.test('[Migrations] getCoreSchema - includes sync_state table', () => {
  const sql = getCoreSchema();

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.sync_state'), true);
});

Deno.test('[Migrations] getCoreSchema - includes webhook_logs table', () => {
  const sql = getCoreSchema();

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.webhook_logs'), true);
});

Deno.test('[Migrations] getCoreSchema - includes sync_jobs table', () => {
  const sql = getCoreSchema();

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.sync_jobs'), true);
});

Deno.test('[Migrations] getCoreSchema - includes sync_job_tasks table', () => {
  const sql = getCoreSchema();

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.sync_job_tasks'), true);
});

// =============================================================================
// getMigrations Auth Tests
// =============================================================================

Deno.test('[Migrations] getMigrations - includes auth SQL by default (auth not specified)', async () => {
  const config = minimalConfig();

  const sql = await getMigrations(config, { includeHeader: false });

  // Should include users table
  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.users'), true);

  // Should include RLS policies
  assertEquals(sql.includes('ENABLE ROW LEVEL SECURITY'), true);
  assertEquals(sql.includes('supasaasy_entities_select_policy'), true);
});

Deno.test('[Migrations] getMigrations - includes auth SQL when auth.enabled: true', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: true },
  };

  const sql = await getMigrations(config, { includeHeader: false });

  // Should include users table
  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.users'), true);

  // Should include RLS policies for all tables
  assertEquals(sql.includes('supasaasy_entities_select_policy'), true);
  assertEquals(sql.includes('supasaasy_sync_state_select_policy'), true);
  assertEquals(sql.includes('supasaasy_webhook_logs_select_policy'), true);
  assertEquals(sql.includes('supasaasy_sync_jobs_select_policy'), true);
  assertEquals(sql.includes('supasaasy_sync_job_tasks_select_policy'), true);
  assertEquals(sql.includes('supasaasy_users_select_policy'), true);
});

Deno.test('[Migrations] getMigrations - excludes auth SQL when auth.enabled: false', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: false },
  };

  const sql = await getMigrations(config, { includeHeader: false });

  // Should NOT include users table
  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.users'), false);

  // Should NOT include RLS policies
  assertEquals(sql.includes('supasaasy_entities_select_policy'), false);
  assertEquals(sql.includes('ENABLE ROW LEVEL SECURITY'), false);
});

Deno.test('[Migrations] getMigrations - users table has correct structure', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: true },
  };

  const sql = await getMigrations(config, { includeHeader: false });

  // Check users table columns
  assertEquals(sql.includes('user_id UUID NOT NULL UNIQUE'), true);
  assertEquals(sql.includes('users_user_id_fkey'), true);
  assertEquals(sql.includes('auth.users(id) ON DELETE CASCADE'), true);
  assertEquals(sql.includes('idx_users_user_id'), true);
});

Deno.test('[Migrations] getMigrations - RLS policies use correct pattern', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: true },
  };

  const sql = await getMigrations(config, { includeHeader: false });

  // All policies should use the authorized users check
  assertEquals(sql.includes('auth.uid() IN (SELECT user_id FROM supasaasy.users)'), true);
});

Deno.test('[Migrations] getMigrations - header shows auth status enabled', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: true },
  };

  const sql = await getMigrations(config, { includeHeader: true });

  assertEquals(sql.includes('Auth/RLS: enabled'), true);
});

Deno.test('[Migrations] getMigrations - header shows auth status disabled', async () => {
  const config: SupaSaaSyConfig = {
    ...minimalConfig(),
    auth: { enabled: false },
  };

  const sql = await getMigrations(config, { includeHeader: true });

  assertEquals(sql.includes('Auth/RLS: disabled'), true);
});

// =============================================================================
// getMigrations General Tests
// =============================================================================

Deno.test('[Migrations] getMigrations - includes core schema', async () => {
  const config = minimalConfig();

  const sql = await getMigrations(config, { includeHeader: false });

  assertEquals(sql.includes('CREATE TABLE IF NOT EXISTS supasaasy.entities'), true);
  assertEquals(sql.includes('CREATE SCHEMA IF NOT EXISTS supasaasy'), true);
});

Deno.test('[Migrations] getMigrations - includes header when requested', async () => {
  const config = minimalConfig();

  const sql = await getMigrations(config, { includeHeader: true, version: '1.2.3' });

  assertEquals(sql.includes('SupaSaaSy Migration'), true);
  assertEquals(sql.includes('Version: 1.2.3'), true);
});

Deno.test('[Migrations] getMigrations - excludes header when not requested', async () => {
  const config = minimalConfig();

  const sql = await getMigrations(config, { includeHeader: false });

  assertEquals(sql.includes('SupaSaaSy Migration'), false);
});
