/**
 * SupaSaaSy Configuration
 *
 * This file defines all app instances and sync schedules.
 * Each app instance represents a connection to an external provider.
 */

import type { SupaSaaSyConfig } from '../supabase/functions/_shared/types/index.ts';

const config: SupaSaaSyConfig = {
  apps: [
    // ==========================================================================
    // Stripe Configuration
    // ==========================================================================
    // Uncomment and configure for your Stripe account.
    //
    // Supported resources:
    //   - customer: Stripe customers
    //   - product: Stripe products
    //   - price: Stripe prices
    //   - plan: Stripe plans (legacy, but still widely used)
    //   - subscription: Stripe subscriptions (includes subscription items)
    //
    // Environment variables needed:
    //   - STRIPE_API_KEY_STRIPE_PRODUCTION: Your Stripe API key (sk_live_... or sk_test_...)
    //   - STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION: Webhook signing secret (whsec_...)
    //
    // {
    //   app_key: 'stripe_production',
    //   name: 'Stripe Production',
    //   connector: 'stripe',
    //   config: {
    //     // Environment variable names for credentials
    //     api_key_env: 'STRIPE_API_KEY_STRIPE_PRODUCTION',
    //     webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION',
    //     // Resources to sync (defaults to all if not specified)
    //     // sync_resources: ['customer', 'product', 'price', 'subscription'],
    //   },
    // },

    // ==========================================================================
    // Multiple Stripe Accounts Example
    // ==========================================================================
    // You can configure multiple Stripe accounts with different app_keys:
    //
    // {
    //   app_key: 'stripe_eu',
    //   name: 'Stripe EU',
    //   connector: 'stripe',
    //   config: {
    //     api_key_env: 'STRIPE_API_KEY_STRIPE_EU',
    //     webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_EU',
    //   },
    // },
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
    //   app_key: 'stripe_production',
    //   cron: '0 */6 * * *', // Every 6 hours
    //   enabled: true,
    // },
  ],
};

export default config;
