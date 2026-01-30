/**
 * Worker Handler Factory
 *
 * Creates a Deno.serve handler for processing sync job tasks via database polling.
 * Workers claim pending tasks and process them completely using the connector's
 * built-in pagination.
 *
 * Features:
 * - Graceful shutdown via beforeunload event handler
 * - Error handling via unhandledrejection event handler
 * - Automatic worker chaining via needs_worker flag (triggers pg_net)
 * - Heartbeat updates during task processing
 * - Cursor persistence for resumable syncs (future)
 *
 * URL pattern: POST /worker
 * Body: { job_id?: string, max_tasks?: number } (all optional)
 */

import type { AppConfig, SupaSaaSyConfig, SyncOptions, SyncResult } from '../types/index.ts';
import {
  claimTask,
  getJobStatus,
  getSyncState,
  type SyncJobTask,
  updateJobStatus,
  updateSyncState,
  updateTaskHeartbeat,
  updateTaskStatus,
} from '../db/index.ts';
import {
  type Connector,
  getAppConfig,
  getConnector,
  type IncrementalConnector,
  setConfig,
  supportsIncrementalSync,
} from '../connectors/index.ts';
import { debugLog, isDebugEnabled } from '../connectors/utils.ts';

// Import connectors to ensure they register themselves
import '../connectors/stripe/index.ts';
import '../connectors/intercom/index.ts';
import '../connectors/notion/index.ts';

// =============================================================================
// Types
// =============================================================================

interface WorkerRequest {
  /** Optional: specific job to process tasks for */
  job_id?: string;
  /** Maximum number of tasks to process before exiting (default: unlimited) */
  max_tasks?: number;
}

interface WorkerResponse {
  success: boolean;
  tasks_processed: number;
  jobs_completed: string[];
  duration_ms: number;
  shutdown_reason?: string;
}

/** State that needs to be saved on shutdown */
interface WorkerState {
  currentTaskId: string | null;
  currentJobId: string | null;
  entityCount: number;
  isProcessing: boolean;
  shutdownRequested: boolean;
}

// Global worker state for graceful shutdown
const workerState: WorkerState = {
  currentTaskId: null,
  currentJobId: null,
  entityCount: 0,
  isProcessing: false,
  shutdownRequested: false,
};

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
  console.error(`Worker error [${status}]: ${message}`);
  return jsonResponse({ error: message, success: false }, status);
}

function successResponse(data: WorkerResponse): Response {
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

/** Maximum allowed request body size (1MB) */
const MAX_REQUEST_SIZE = 1024 * 1024;

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
// Worker Configuration
// =============================================================================

/** Maximum time a worker can run (to prevent hitting edge function limit) */
const MAX_WORKER_RUNTIME_MS = 45000; // 45 seconds (leave 5s buffer before 50s limit)

/** How often to update heartbeat during processing (ms) */
const HEARTBEAT_INTERVAL_MS = 5000;

// =============================================================================
// Graceful Shutdown Handlers
// =============================================================================

/**
 * Handle graceful shutdown when Edge Function is about to terminate.
 * Saves current task state and requests worker continuation if needed.
 */
async function handleBeforeUnload(reason: string): Promise<void> {
  console.log(`Worker shutdown requested: ${reason}`);
  workerState.shutdownRequested = true;

  // If we're in the middle of processing a task, save state
  if (workerState.isProcessing && workerState.currentTaskId) {
    console.log(`Saving state for task ${workerState.currentTaskId} before shutdown`);

    try {
      // Update task heartbeat with current progress
      await updateTaskHeartbeat(
        workerState.currentTaskId,
        undefined, // cursor would go here if we had it
        workerState.entityCount,
      );

      // Request worker continuation if job isn't complete
      if (workerState.currentJobId) {
        const { data: jobStatus } = await getJobStatus(workerState.currentJobId);
        if (jobStatus && jobStatus.status === 'processing') {
          console.log(`Requesting worker continuation for job ${workerState.currentJobId}`);
          await updateJobStatus(workerState.currentJobId, {
            needs_worker: true,
          });
        }
      }
    } catch (err) {
      console.error('Error saving state during shutdown:', err);
    }
  }
}

/**
 * Handle unhandled promise rejections.
 * Logs the error and prevents the default behavior.
 */
// deno-lint-ignore no-explicit-any
function handleUnhandledRejection(event: any): void {
  console.error('Unhandled rejection in worker:', event?.reason);
  if (event?.preventDefault) {
    event.preventDefault();
  }

  // If we have an active task, mark it as failed
  if (workerState.currentTaskId) {
    const errorMessage = event?.reason instanceof Error
      ? event.reason.message
      : String(event?.reason);

    updateTaskStatus(
      workerState.currentTaskId,
      'failed',
      workerState.entityCount,
      `Unhandled error: ${errorMessage}`,
    ).catch((err) => {
      console.error('Failed to update task status after unhandled rejection:', err);
    });
  }
}

// =============================================================================
// Task Processing
// =============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a complete resource type using the connector's sync methods.
 * The connector handles pagination internally.
 * Updates heartbeat periodically during processing.
 */
async function processResourceSync(
  connector: Connector,
  appConfig: AppConfig,
  task: SyncJobTask,
  mode: string,
  sinceDatetime?: Date,
): Promise<{ entitiesProcessed: number; error?: string }> {
  // Update global state for graceful shutdown
  workerState.currentTaskId = task.id;
  workerState.entityCount = task.entity_count || 0;
  workerState.isProcessing = true;

  debugLog('worker', 'Starting resource sync', {
    taskId: task.id,
    jobId: task.job_id,
    resourceType: task.resource_type,
    mode,
    connector: appConfig.connector,
    appKey: appConfig.app_key,
    sinceDatetime: sinceDatetime?.toISOString(),
    cursor: task.cursor,
  });

  // Set up heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    if (workerState.isProcessing && !workerState.shutdownRequested) {
      try {
        await updateTaskHeartbeat(task.id, undefined, workerState.entityCount);
        debugLog('worker', 'Heartbeat updated', {
          taskId: task.id,
          entityCount: workerState.entityCount,
        });
      } catch (err) {
        console.error('Heartbeat update failed:', err);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const syncOptions: SyncOptions = {
      resourceTypes: [task.resource_type],
      // If task has a cursor, pass it for resumption (future enhancement)
      cursor: task.cursor || undefined,
      // Enable verbose logging when debug mode is enabled
      verbose: isDebugEnabled(),
    };

    debugLog('worker', 'Sync options configured', {
      taskId: task.id,
      resourceTypes: syncOptions.resourceTypes,
      cursor: syncOptions.cursor,
      verbose: syncOptions.verbose,
    });

    let syncResult: SyncResult;

    if (mode === 'incremental' && sinceDatetime && supportsIncrementalSync(connector)) {
      // Incremental sync
      console.log(
        `Processing incremental sync for resource ${task.resource_type} since ${sinceDatetime.toISOString()}`,
      );
      debugLog('worker', 'Running incremental sync', {
        taskId: task.id,
        resourceType: task.resource_type,
        sinceDatetime: sinceDatetime.toISOString(),
      });
      syncResult = await (connector as IncrementalConnector).incrementalSync(
        appConfig,
        sinceDatetime,
        syncOptions,
      );
    } else {
      // Full sync
      console.log(`Processing full sync for resource ${task.resource_type}`);
      debugLog('worker', 'Running full sync', {
        taskId: task.id,
        resourceType: task.resource_type,
        reason: mode !== 'incremental'
          ? 'full mode requested'
          : !sinceDatetime
          ? 'no since datetime'
          : 'connector does not support incremental',
      });
      syncResult = await connector.fullSync(appConfig, syncOptions);
    }

    const entitiesProcessed = syncResult.created + syncResult.updated + syncResult.deleted;
    workerState.entityCount = entitiesProcessed;

    debugLog('worker', 'Sync completed', {
      taskId: task.id,
      resourceType: task.resource_type,
      success: syncResult.success,
      created: syncResult.created,
      updated: syncResult.updated,
      deleted: syncResult.deleted,
      errors: syncResult.errors,
      durationMs: syncResult.durationMs,
    });

    if (!syncResult.success && syncResult.errorMessages?.length) {
      return {
        entitiesProcessed,
        error: syncResult.errorMessages.join('; '),
      };
    }

    console.log(
      `Completed sync for ${task.resource_type}: created=${syncResult.created}, updated=${syncResult.updated}, deleted=${syncResult.deleted}`,
    );

    return { entitiesProcessed };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`Task processing error for ${task.resource_type}: ${errorMessage}`);
    debugLog('worker', 'Sync failed with exception', {
      taskId: task.id,
      resourceType: task.resource_type,
      error: errorMessage,
    });
    return {
      entitiesProcessed: workerState.entityCount,
      error: errorMessage,
    };
  } finally {
    // Clean up heartbeat interval
    clearInterval(heartbeatInterval);
    workerState.isProcessing = false;
  }
}

/**
 * Check if all tasks are complete and update job status accordingly
 */
async function checkJobCompletion(jobId: string): Promise<boolean> {
  const { data: jobStatus } = await getJobStatus(jobId);
  if (!jobStatus) {
    console.error(`Job ${jobId} not found when checking completion`);
    return false;
  }

  const pendingTasks = jobStatus.tasks.filter((t) => t.status === 'pending').length;
  const processingTasks = jobStatus.tasks.filter((t) => t.status === 'processing').length;

  // Job is complete when no pending or processing tasks remain
  if (pendingTasks === 0 && processingTasks === 0) {
    const hasFailures = jobStatus.failed_tasks > 0;
    const newStatus = hasFailures ? 'failed' : 'completed';

    console.log(`Job ${jobId} is complete with status: ${newStatus}`);

    await updateJobStatus(jobId, {
      status: newStatus,
      completed_at: new Date(),
      needs_worker: false, // No more workers needed
    });

    return true;
  }

  return false;
}

/**
 * Process tasks for a specific job or any pending job
 */
async function processTasksForJob(
  config: SupaSaaSyConfig,
  targetJobId: string | undefined,
  maxTasks: number | undefined,
  startTime: number,
): Promise<{ tasksProcessed: number; jobsCompleted: string[]; shutdownReason?: string }> {
  let tasksProcessed = 0;
  const jobsCompleted: string[] = [];
  const processedJobs = new Set<string>();
  let shutdownReason: string | undefined;

  debugLog('worker', 'Starting task processing loop', {
    targetJobId,
    maxTasks,
    maxRuntimeMs: MAX_WORKER_RUNTIME_MS,
  });

  while (true) {
    // Check if shutdown was requested
    if (workerState.shutdownRequested) {
      shutdownReason = 'shutdown_requested';
      debugLog('worker', 'Shutdown requested, exiting loop');
      break;
    }

    // Check if we've exceeded max runtime (leave buffer for cleanup)
    if (Date.now() - startTime > MAX_WORKER_RUNTIME_MS) {
      console.log('Worker approaching time limit, requesting continuation');
      shutdownReason = 'timeout';

      debugLog('worker', 'Runtime limit exceeded', {
        elapsedMs: Date.now() - startTime,
        maxRuntimeMs: MAX_WORKER_RUNTIME_MS,
      });

      // Request worker continuation for any active job
      if (targetJobId && !processedJobs.has(targetJobId)) {
        await updateJobStatus(targetJobId, { needs_worker: true });
      }

      break;
    }

    // Check if we've hit max tasks limit
    if (maxTasks !== undefined && tasksProcessed >= maxTasks) {
      console.log(`Processed max tasks (${maxTasks}), exiting`);
      shutdownReason = 'max_tasks_reached';
      debugLog('worker', 'Max tasks reached', { tasksProcessed, maxTasks });
      break;
    }

    // Try to claim a task for the target job (or any job if not specified)
    debugLog('worker', 'Attempting to claim task', { targetJobId });
    const { data: task, error: claimError } = await claimTask(targetJobId);

    if (claimError) {
      console.error(`Error claiming task: ${claimError.message}`);
      debugLog('worker', 'Task claim error', { error: claimError.message });
      await sleep(1000);
      continue;
    }

    if (!task) {
      // No pending tasks available
      console.log('No pending tasks available');
      debugLog('worker', 'No pending tasks available');

      // Check if target job is complete
      if (targetJobId && !processedJobs.has(targetJobId)) {
        const isComplete = await checkJobCompletion(targetJobId);
        if (isComplete) {
          jobsCompleted.push(targetJobId);
          processedJobs.add(targetJobId);
        }
      }

      break; // Exit if no work available
    }

    debugLog('worker', 'Task claimed', {
      taskId: task.id,
      jobId: task.job_id,
      resourceType: task.resource_type,
    });

    const jobId = task.job_id;
    workerState.currentJobId = jobId;

    // Get job details
    const { data: jobStatus } = await getJobStatus(jobId);
    if (!jobStatus) {
      console.error(`Job ${jobId} not found`);
      debugLog('worker', 'Job not found', { jobId });
      await updateTaskStatus(task.id, 'failed', 0, `Job ${jobId} not found`);
      await sleep(100);
      continue;
    }

    debugLog('worker', 'Job status retrieved', {
      jobId,
      appKey: jobStatus.app_key,
      mode: jobStatus.mode,
      status: jobStatus.status,
      totalTasks: jobStatus.total_tasks,
      completedTasks: jobStatus.completed_tasks,
      failedTasks: jobStatus.failed_tasks,
    });

    // Get app configuration
    const appConfig = getAppConfig(jobStatus.app_key, config);
    if (!appConfig) {
      console.error(`Unknown app_key: ${jobStatus.app_key}`);
      debugLog('worker', 'Unknown app_key', { appKey: jobStatus.app_key });
      await updateTaskStatus(task.id, 'failed', 0, `Unknown app_key: ${jobStatus.app_key}`);
      await sleep(100);
      continue;
    }

    debugLog('worker', 'App config found', {
      appKey: appConfig.app_key,
      connector: appConfig.connector,
    });

    // Get connector
    const connector = await getConnector(appConfig.connector);
    if (!connector) {
      console.error(`Connector not found: ${appConfig.connector}`);
      debugLog('worker', 'Connector not found', { connector: appConfig.connector });
      await updateTaskStatus(task.id, 'failed', 0, `Connector not found: ${appConfig.connector}`);
      await sleep(100);
      continue;
    }

    debugLog('worker', 'Connector retrieved', {
      connectorName: connector.metadata.name,
      supportedResources: connector.metadata.supportedResources.map((r) => r.resourceType),
    });

    // Verify the resource type is supported
    const resource = connector.metadata.supportedResources.find(
      (r) => r.resourceType === task.resource_type,
    );

    if (!resource) {
      console.error(`Resource type not supported: ${task.resource_type}`);
      debugLog('worker', 'Resource type not supported', {
        resourceType: task.resource_type,
        supportedTypes: connector.metadata.supportedResources.map((r) => r.resourceType),
      });
      await updateTaskStatus(
        task.id,
        'failed',
        0,
        `Resource type not supported: ${task.resource_type}`,
      );
      await sleep(100);
      continue;
    }

    // Verify this isn't a nested resource (should be synced with parent)
    if (resource.syncedWithParent) {
      console.error(
        `Resource ${task.resource_type} is synced with ${resource.syncedWithParent}, not independently`,
      );
      debugLog('worker', 'Resource is nested (synced with parent)', {
        resourceType: task.resource_type,
        parentType: resource.syncedWithParent,
      });
      await updateTaskStatus(
        task.id,
        'failed',
        0,
        `Resource ${task.resource_type} is synced with ${resource.syncedWithParent}, not independently`,
      );
      await sleep(100);
      continue;
    }

    // Update job status to processing if not already
    if (jobStatus.status === 'pending') {
      debugLog('worker', 'Updating job status to processing', { jobId });
      await updateJobStatus(jobId, {
        status: 'processing',
        started_at: new Date(),
        needs_worker: false, // Worker is now active
      });
    }

    console.log(
      `Processing task ${tasksProcessed + 1}: resource=${task.resource_type} for job ${jobId}`,
    );

    // Get sync state for incremental sync
    let sinceDatetime: Date | undefined;
    if (jobStatus.mode === 'incremental' && resource.supportsIncrementalSync) {
      const { data: syncState } = await getSyncState(
        appConfig.app_key,
        resource.collectionKey,
      );
      if (syncState) {
        sinceDatetime = new Date(syncState.last_synced_at);
        debugLog('worker', 'Retrieved sync state for incremental sync', {
          appKey: appConfig.app_key,
          collectionKey: resource.collectionKey,
          lastSyncedAt: syncState.last_synced_at,
        });
      } else {
        debugLog('worker', 'No sync state found, will use full sync', {
          appKey: appConfig.app_key,
          collectionKey: resource.collectionKey,
        });
      }
    }

    // Process the task - this runs the full sync for the resource type
    // The connector handles pagination internally
    const result = await processResourceSync(
      connector,
      appConfig,
      task,
      jobStatus.mode,
      sinceDatetime,
    );

    // Check if shutdown was requested during processing
    if (workerState.shutdownRequested) {
      shutdownReason = 'shutdown_during_task';
      debugLog('worker', 'Shutdown requested during task processing');
      // Don't update task status - let the next worker continue
      await updateJobStatus(jobId, { needs_worker: true });
      break;
    }

    // Update task status
    if (result.error) {
      debugLog('worker', 'Task failed', {
        taskId: task.id,
        resourceType: task.resource_type,
        error: result.error,
        entitiesProcessed: result.entitiesProcessed,
      });
      await updateTaskStatus(task.id, 'failed', result.entitiesProcessed, result.error);
      await updateJobStatus(jobId, {
        failed_tasks: jobStatus.failed_tasks + 1,
        processed_entities: jobStatus.processed_entities + result.entitiesProcessed,
      });
    } else {
      debugLog('worker', 'Task completed successfully', {
        taskId: task.id,
        resourceType: task.resource_type,
        entitiesProcessed: result.entitiesProcessed,
      });
      await updateTaskStatus(task.id, 'completed', result.entitiesProcessed);
      await updateJobStatus(jobId, {
        completed_tasks: jobStatus.completed_tasks + 1,
        processed_entities: jobStatus.processed_entities + result.entitiesProcessed,
      });

      // Update sync state for this resource type so incremental sync knows when last sync happened
      await updateSyncState(appConfig.app_key, resource.collectionKey, new Date());
      debugLog('worker', 'Sync state updated', {
        appKey: appConfig.app_key,
        collectionKey: resource.collectionKey,
      });
    }

    tasksProcessed++;
    workerState.currentTaskId = null;

    // Check if job is complete
    const isComplete = await checkJobCompletion(jobId);
    if (isComplete && !processedJobs.has(jobId)) {
      jobsCompleted.push(jobId);
      processedJobs.add(jobId);
      debugLog('worker', 'Job completed', { jobId });
    }

    // Small delay between tasks
    await sleep(100);
  }

  debugLog('worker', 'Task processing loop finished', {
    tasksProcessed,
    jobsCompleted,
    shutdownReason,
    elapsedMs: Date.now() - startTime,
  });

  return { tasksProcessed, jobsCompleted, shutdownReason };
}

// =============================================================================
// Handler Factory
// =============================================================================

/**
 * Create a worker handler for the given configuration.
 *
 * This handler uses database polling to find and process tasks.
 * Each task represents a complete resource type to sync.
 * Workers process tasks serially, with the connector handling pagination internally.
 *
 * Features:
 * - Graceful shutdown handling via beforeunload event
 * - Unhandled rejection handling for error recovery
 * - Automatic worker chaining via needs_worker flag
 * - Heartbeat updates during task processing
 *
 * @param config The SupaSaaSy configuration
 * @returns A Deno.serve compatible handler function
 *
 * @example
 * ```typescript
 * import { createWorkerHandler } from 'supasaasy';
 * import config from '../../../supasaasy.config.ts';
 *
 * Deno.serve(createWorkerHandler(config));
 * ```
 */
export function createWorkerHandler(
  config: SupaSaaSyConfig,
): (req: Request) => Promise<Response> {
  // Set the global config for connector lookups
  setConfig(config);

  // Register shutdown handlers (these persist across requests)
  // Note: These use Deno/EdgeRuntime specific APIs
  try {
    // Handle graceful shutdown
    // deno-lint-ignore no-explicit-any
    (globalThis as any).addEventListener('beforeunload', (event: any) => {
      const reason = event?.detail?.reason || 'unknown';
      // Use waitUntil to ensure shutdown handler completes
      // deno-lint-ignore no-explicit-any
      const EdgeRuntime = (globalThis as any).EdgeRuntime;
      if (EdgeRuntime?.waitUntil) {
        EdgeRuntime.waitUntil(handleBeforeUnload(reason));
      } else {
        handleBeforeUnload(reason);
      }
    });

    // Handle unhandled rejections
    // deno-lint-ignore no-explicit-any
    (globalThis as any).addEventListener('unhandledrejection', handleUnhandledRejection);
  } catch {
    // Event listeners not available in this environment
  }

  return async (req: Request) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 405);
    }

    const startTime = Date.now();

    // Reset worker state for new request
    workerState.currentTaskId = null;
    workerState.currentJobId = null;
    workerState.entityCount = 0;
    workerState.isProcessing = false;
    workerState.shutdownRequested = false;

    debugLog('worker', 'Worker request received', {
      method: req.method,
      url: req.url,
      debugEnabled: isDebugEnabled(),
    });

    try {
      // Verify admin API key
      if (!verifyAdminApiKey(req)) {
        debugLog('worker', 'Authentication failed');
        return errorResponse('Unauthorized: invalid or missing API key', 401);
      }

      // Parse request body
      const contentLength = req.headers.get('Content-Length');
      if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
        return errorResponse('Request body too large', 413);
      }

      let requestBody: WorkerRequest = {};
      try {
        const bodyText = await req.text();
        if (bodyText.length > 0) {
          if (bodyText.length > MAX_REQUEST_SIZE) {
            return errorResponse('Request body too large', 413);
          }
          requestBody = JSON.parse(bodyText);
        }
      } catch {
        return errorResponse('Invalid JSON body', 400);
      }

      const targetJobId = requestBody.job_id;
      const maxTasks = requestBody.max_tasks;

      console.log(
        `Worker started: ${targetJobId ? `job=${targetJobId}` : 'any job'}, max_tasks=${
          maxTasks || 'unlimited'
        }`,
      );

      debugLog('worker', 'Worker started', {
        targetJobId,
        maxTasks,
        maxRuntimeMs: MAX_WORKER_RUNTIME_MS,
      });

      // Process tasks
      const { tasksProcessed, jobsCompleted, shutdownReason } = await processTasksForJob(
        config,
        targetJobId,
        maxTasks,
        startTime,
      );

      const duration = Date.now() - startTime;

      console.log(
        `Worker completed: tasks_processed=${tasksProcessed}, jobs_completed=${jobsCompleted.length}, duration=${duration}ms${
          shutdownReason ? `, reason=${shutdownReason}` : ''
        }`,
      );

      debugLog('worker', 'Worker completed', {
        tasksProcessed,
        jobsCompleted,
        durationMs: duration,
        shutdownReason,
      });

      return successResponse({
        success: true,
        tasks_processed: tasksProcessed,
        jobs_completed: jobsCompleted,
        duration_ms: duration,
        shutdown_reason: shutdownReason,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Unexpected error in worker: ${errorMessage}`);

      debugLog('worker', 'Worker failed with unexpected error', {
        error: errorMessage,
        currentJobId: workerState.currentJobId,
        currentTaskId: workerState.currentTaskId,
      });

      // Request worker continuation if we have an active job
      if (workerState.currentJobId) {
        try {
          await updateJobStatus(workerState.currentJobId, { needs_worker: true });
        } catch (err) {
          console.error('Failed to request worker continuation:', err);
        }
      }

      return errorResponse('Internal server error', 500);
    }
  };
}
