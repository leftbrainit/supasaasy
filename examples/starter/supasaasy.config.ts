/**
 * SupaSaaSy Configuration
 *
 * This file defines all app instances and sync schedules.
 * Each app instance represents a connection to an external provider.
 */

// For local development, use relative import to the library
// In production, change to: import { defineConfig } from '@supasaasy/core';
import { defineConfig } from '../../packages/supasaasy/mod.ts';

export default defineConfig({
  apps: [
    // ==========================================================================
    // Stripe Configuration
    // ==========================================================================
    {
      app_key: 'stripe_test',
      name: 'Stripe Test',
      connector: 'stripe',
      config: {
        api_key_env: 'STRIPE_API_KEY',
        webhook_secret_env: 'STRIPE_WEBHOOK_SECRET',
      },
    },

    // ==========================================================================
    // Intercom Configuration
    // ==========================================================================
    {
      app_key: 'intercom_test',
      name: 'Intercom Test',
      connector: 'intercom',
      config: {
        api_key_env: 'INTERCOM_API_KEY',
        webhook_secret_env: 'INTERCOM_WEBHOOK_SECRET',
      },
    },

    // ==========================================================================
    // Notion Configuration
    // ==========================================================================
    // Notion connector syncs data sources (tables), pages, and users from
    // Notion workspaces. Requires a Notion internal integration with:
    // - Read content capability
    // - Read user information capability
    // - Webhook configuration (Enterprise plan for real-time updates)
    //
    // API version: 2025-09-03 (with first-class data source support)
    //
    {
      app_key: 'notion_test',
      name: 'Notion Test',
      connector: 'notion',
      config: {
        api_key_env: 'NOTION_API_KEY',
        webhook_secret_env: 'NOTION_WEBHOOK_SECRET',
      },
      // Optional: limit historical sync to records created after this date
      // sync_from: '2024-01-01T00:00:00Z',
    },
  ],

  sync_schedules: [
    // ==========================================================================
    // Sync Schedules
    // ==========================================================================
    // Configure periodic sync schedules for each app instance.
    // Cron format: minute hour day-of-month month day-of-week
    //
    // Examples:
    //   - '0 * * * *'     - Every hour
    //   - '0 */6 * * *'   - Every 6 hours
    //   - '0 0 * * *'     - Daily at midnight
    //   - '0 2 * * 0'     - Weekly on Sunday at 2 AM
    //
    // {
    //   app_key: 'stripe_prod',
    //   cron: '0 */6 * * *', // Every 6 hours
    //   enabled: true,
    // },
  ],

  // ==========================================================================
  // Webhook Logging
  // ==========================================================================
  // Optional configuration to log webhook requests to the database for
  // debugging and auditing purposes. When enabled, all webhook requests
  // (successful, failed, and rejected) are stored in supasaasy.webhook_logs.
  //
  // Logs include:
  // - Request details (method, path, headers with sensitive values redacted)
  // - Response status and body
  // - Error messages for failed requests
  // - Processing duration for performance monitoring
  //
  webhook_logging: {
    enabled: true, // Set to true to enable webhook logging
  },
});
