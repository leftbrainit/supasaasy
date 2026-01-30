/**
 * Worker Edge Function
 *
 * Processes sync job tasks via database polling.
 * URL pattern: POST /worker
 * Body: { job_id?: string, max_tasks?: number } (all optional)
 *
 * Authentication: Requires Bearer token matching ADMIN_API_KEY environment variable.
 *
 * Workers poll the database for pending tasks and process them serially.
 * Each task represents one resource type to sync completely.
 */

// For local development, the import map in deno.json points to the local library
// In production, change to: import { createWorkerHandler } from '@supasaasy/core';
import { createWorkerHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createWorkerHandler(config));
