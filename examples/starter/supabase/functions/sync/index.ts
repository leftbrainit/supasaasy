/**
 * Sync Edge Function
 *
 * Performs full and incremental synchronization of SaaS data.
 * URL pattern: POST /sync
 * Body: { app_key: string, mode?: 'full' | 'incremental', resource_types?: string[] }
 *
 * Authentication: Requires Bearer token matching ADMIN_API_KEY environment variable.
 */

// For local development, the import map in deno.json points to the local library
// In production, change to: import { createSyncHandler } from '@supasaasy/core';
import { createSyncHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createSyncHandler(config));
