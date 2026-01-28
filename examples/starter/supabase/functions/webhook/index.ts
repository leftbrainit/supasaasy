/**
 * Webhook Edge Function
 *
 * Receives and processes incoming webhooks from SaaS providers.
 * URL pattern: POST /webhook/{app_key}
 */

// For local development, use relative import to the library
// In production, change to: import { createWebhookHandler } from '@supasaasy/core';
import { createWebhookHandler } from '../../../../../packages/supasaasy/mod.ts';
import config from '../../../supasaasy.config.ts';

Deno.serve(createWebhookHandler(config));
