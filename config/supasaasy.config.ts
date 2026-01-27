/**
 * SupaSaaSy Configuration
 *
 * This file defines all app instances and sync schedules.
 * Each app instance represents a connection to an external provider.
 */

import type { SupaSaaSyConfig } from '../supabase/functions/_shared/types/index.ts';

const config: SupaSaaSyConfig = {
  apps: [
    // Example Stripe configuration
    // Uncomment and configure for your Stripe account
    // {
    //   app_key: 'stripe_production',
    //   name: 'Stripe Production',
    //   connector: 'stripe',
    //   config: {
    //     // API key is loaded from environment variables
    //     // Set STRIPE_API_KEY_STRIPE_PRODUCTION in your environment
    //     webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION',
    //     api_key_env: 'STRIPE_API_KEY_STRIPE_PRODUCTION',
    //     // Objects to sync
    //     sync_objects: ['customer', 'subscription', 'invoice', 'payment_intent'],
    //   },
    // },
  ],

  sync_schedules: [
    // Example sync schedule
    // Uncomment to enable periodic sync for an app
    // {
    //   app_key: 'stripe_production',
    //   cron: '0 */6 * * *', // Every 6 hours
    //   enabled: true,
    // },
  ],
};

export default config;
