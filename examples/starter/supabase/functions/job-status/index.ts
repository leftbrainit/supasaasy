/**
 * Job Status Edge Function
 *
 * Queries sync job status and progress.
 * URL pattern: GET /job-status?job_id=:job_id
 * Query params: ?include_tasks=true (optional, includes task details)
 *
 * Authentication: Requires Bearer token matching ADMIN_API_KEY environment variable.
 *
 * Returns job metadata, progress percentage, and task statistics.
 */

// For local development, the import map in deno.json points to the local library
// In production, change to: import { createJobStatusHandler } from '@supasaasy/core';
import { createJobStatusHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createJobStatusHandler(config));
