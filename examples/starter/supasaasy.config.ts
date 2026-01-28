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
});
