/**
 * Webhook Edge Function
 *
 * Receives and processes incoming webhooks from SaaS providers.
 * URL pattern: POST /webhook/{app_key}
 */

// For local development, the import map in deno.json points to the local library
// In production, change to: import { createWebhookHandler } from '@supasaasy/core';
import { createWebhookHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createWebhookHandler(config));
