/**
 * Job Status Handler Factory
 *
 * Creates a Deno.serve handler for querying sync job status and progress.
 * URL pattern: GET /sync/jobs/:job_id
 */

import { getJobStatus } from '../db/index.ts';
import type { SupaSaaSyConfig } from '../types/index.ts';
import { setConfig } from '../connectors/index.ts';

// Import connectors to ensure they register themselves
import '../connectors/stripe/index.ts';
import '../connectors/intercom/index.ts';
import '../connectors/notion/index.ts';

// =============================================================================
// Types
// =============================================================================

interface JobStatusResponse {
  success: boolean;
  job_id: string;
  app_key: string;
  mode: string;
  status: string;
  progress_percentage: number;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  processed_entities: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  tasks?: Array<{
    resource_type: string;
    status: string;
    entity_count: number | null;
    error_message: string | null;
  }>;
}

// =============================================================================
// Response Helpers
// =============================================================================

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json',
};

function jsonResponse(
  data: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: RESPONSE_HEADERS,
  });
}

function errorResponse(message: string, status: number): Response {
  console.error(`Job status error [${status}]: ${message}`);
  return jsonResponse({ error: message, success: false }, status);
}

function successResponse(data: JobStatusResponse): Response {
  return jsonResponse(data as unknown as Record<string, unknown>, 200);
}

// =============================================================================
// Security Helpers
// =============================================================================

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if both strings are equal.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Verify the admin API key from the Authorization header.
 * Expected format: "Bearer <admin_api_key>"
 * Uses constant-time comparison to prevent timing attacks.
 */
function verifyAdminApiKey(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return false;
  }

  const adminApiKey = Deno.env.get('ADMIN_API_KEY');
  if (!adminApiKey) {
    console.error('ADMIN_API_KEY environment variable is not set');
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(token, adminApiKey);
}

// =============================================================================
// URL Parsing
// =============================================================================

/**
 * Extract job ID from URL.
 * Supports patterns like:
 *   - Query param: ?job_id=xxx
 *   - Path: /sync/jobs/:job_id
 *   - Path: /jobs/:job_id
 *   - Path: /job-status/:job_id (Edge Functions pattern)
 *   - Path: /:job_id
 */
function extractJobIdFromUrl(url: URL): string | null {
  // First check query param (preferred for Edge Functions)
  const queryJobId = url.searchParams.get('job_id');
  if (queryJobId) {
    return queryJobId;
  }

  const pathParts = url.pathname.split('/').filter(Boolean);

  // Pattern 1: /sync/jobs/:job_id
  if (pathParts.length >= 3 && pathParts[0] === 'sync' && pathParts[1] === 'jobs') {
    return pathParts[2];
  }

  // Pattern 2: /jobs/:job_id
  if (pathParts.length >= 2 && pathParts[0] === 'jobs') {
    return pathParts[1];
  }

  // Pattern 3: /job-status/:job_id (Edge Functions URL pattern)
  if (pathParts.length >= 2 && pathParts[0] === 'job-status') {
    return pathParts[1];
  }

  // Pattern 4: /:job_id (direct job ID - must be UUID-like)
  if (pathParts.length === 1 && /^[0-9a-f-]{36}$/i.test(pathParts[0])) {
    return pathParts[0];
  }

  return null;
}

// =============================================================================
// Handler Factory
// =============================================================================

/**
 * Create a job status handler for the given configuration.
 *
 * @param config The SupaSaaSy configuration
 * @returns A Deno.serve compatible handler function
 *
 * @example
 * ```typescript
 * import { createJobStatusHandler } from 'supasaasy';
 * import config from '../supasaasy.config.ts';
 *
 * Deno.serve(createJobStatusHandler(config));
 * ```
 */
export function createJobStatusHandler(
  config: SupaSaaSyConfig,
): (req: Request) => Promise<Response> {
  // Set the global config for connector lookups
  setConfig(config);

  return async (req: Request): Promise<Response> => {
    // Only accept GET requests
    if (req.method !== 'GET') {
      return errorResponse('Method not allowed', 405);
    }

    try {
      // Verify admin API key
      if (!verifyAdminApiKey(req)) {
        return errorResponse('Unauthorized: invalid or missing API key', 401);
      }

      // Extract job ID from URL
      const url = new URL(req.url);
      const jobId = extractJobIdFromUrl(url);

      if (!jobId) {
        return errorResponse('Missing job ID in URL path', 400);
      }

      console.log(`Fetching status for job ${jobId}`);

      // Get job status with aggregated statistics
      const { data: jobStatus, error } = await getJobStatus(jobId);

      if (error) {
        return errorResponse(`Failed to fetch job status: ${error.message}`, 500);
      }

      if (!jobStatus) {
        return errorResponse('Job not found', 404);
      }

      // Format tasks for response (optional, can be filtered via query param)
      const includeTasks = url.searchParams.get('include_tasks') === 'true';
      const tasks = includeTasks
        ? jobStatus.tasks.map((task) => ({
          resource_type: task.resource_type,
          status: task.status,
          entity_count: task.entity_count,
          error_message: task.error_message,
        }))
        : undefined;

      const response: JobStatusResponse = {
        success: true,
        job_id: jobStatus.id,
        app_key: jobStatus.app_key,
        mode: jobStatus.mode,
        status: jobStatus.status,
        progress_percentage: jobStatus.progress_percentage,
        total_tasks: jobStatus.total_tasks,
        completed_tasks: jobStatus.completed_tasks,
        failed_tasks: jobStatus.failed_tasks,
        processed_entities: jobStatus.processed_entities,
        created_at: jobStatus.created_at,
        started_at: jobStatus.started_at,
        completed_at: jobStatus.completed_at,
        error_message: jobStatus.error_message,
        tasks,
      };

      return successResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Unexpected error fetching job status: ${errorMessage}`);
      return errorResponse('Internal server error', 500);
    }
  };
}
