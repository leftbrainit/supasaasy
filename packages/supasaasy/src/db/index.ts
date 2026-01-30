/**
 * Database Utilities
 *
 * Provides database connection and helper functions for Edge Functions.
 */
// deno-lint-ignore-file no-explicit-any

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { debugLog } from '../connectors/utils.ts';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client for database operations
 * Uses service role key for full database access
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  // Correct type: provide explicit generics for schema and avoid type error
  supabaseClient = createClient<any, 'supasaasy', any>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'supasaasy',
    },
  });

  return supabaseClient;
}

/**
 * Reset the client (useful for testing)
 */
export function resetClient(): void {
  supabaseClient = null;
}

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Entity record as stored in the database
 */
export interface Entity {
  id: string;
  external_id: string;
  app_key: string;
  collection_key: string;
  api_version: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  deleted_at: string | null;
}

/**
 * Data required to upsert an entity
 */
export interface UpsertEntityData {
  /**
   * Optional custom UUID for the entity.
   * When provided, this UUID will be used as the primary key instead of auto-generating one.
   * Useful for connectors like Notion where the upstream API uses UUIDs that should be preserved.
   */
  id?: string;
  external_id: string;
  app_key: string;
  collection_key: string;
  raw_payload: Record<string, unknown>;
  api_version?: string;
  archived_at?: string | null;
}

/**
 * Result of an upsert operation
 */
export interface UpsertResult {
  data: Entity | null;
  error: Error | null;
  /** Whether a new record was created (true) or existing was updated (false) */
  created: boolean;
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  /** Number of records deleted */
  count: number;
  error: Error | null;
}

// =============================================================================
// Entity Helper Functions
// =============================================================================

/**
 * Upsert an entity using the unique constraint for conflict resolution.
 * If an entity with the same (app_key, collection_key, external_id) exists,
 * it will be updated; otherwise, a new record is created.
 *
 * @param data The entity data to upsert
 * @returns The upserted entity and whether it was created or updated
 */
export async function upsertEntity(data: UpsertEntityData): Promise<UpsertResult> {
  const client = getSupabaseClient();

  debugLog('db', 'Upserting entity', {
    appKey: data.app_key,
    collectionKey: data.collection_key,
    externalId: data.external_id,
    hasCustomId: !!data.id,
  });

  try {
    // First, try to get existing record to determine if this is create or update
    const { data: existing } = await client
      .from('entities')
      .select('id')
      .eq('app_key', data.app_key)
      .eq('collection_key', data.collection_key)
      .eq('external_id', data.external_id)
      .maybeSingle();

    const isCreate = !existing;

    debugLog('db', 'Entity lookup result', {
      externalId: data.external_id,
      exists: !isCreate,
    });

    // Build the record, including id if provided
    const record: Record<string, unknown> = {
      external_id: data.external_id,
      app_key: data.app_key,
      collection_key: data.collection_key,
      raw_payload: data.raw_payload,
      api_version: data.api_version ?? null,
      archived_at: data.archived_at ?? null,
    };

    // Include custom id if provided (e.g., Notion UUIDs)
    if (data.id) {
      record.id = data.id;
    }

    // Perform the upsert using the unique constraint
    const { data: result, error } = await client
      .from('entities')
      .upsert(record, {
        onConflict: 'app_key,collection_key,external_id',
      })
      .select()
      .single();

    if (error) {
      debugLog('db', 'Entity upsert failed', {
        externalId: data.external_id,
        error: error.message,
      });
      return { data: null, error: new Error(error.message), created: false };
    }

    debugLog('db', 'Entity upsert succeeded', {
      externalId: data.external_id,
      created: isCreate,
    });

    return { data: result as Entity, error: null, created: isCreate };
  } catch (err) {
    debugLog('db', 'Entity upsert exception', {
      externalId: data.external_id,
      error: (err as Error).message,
    });
    return { data: null, error: err as Error, created: false };
  }
}

/**
 * Upsert multiple entities in a single batch operation.
 *
 * @param entities Array of entity data to upsert
 * @returns Array of upserted entities
 */
export async function upsertEntities(
  entities: UpsertEntityData[],
): Promise<{ data: Entity[] | null; error: Error | null }> {
  if (entities.length === 0) {
    debugLog('db', 'Skipping batch upsert - empty array');
    return { data: [], error: null };
  }

  const client = getSupabaseClient();

  const collectionKeys = [...new Set(entities.map((e) => e.collection_key))];
  debugLog('db', 'Batch upserting entities', {
    count: entities.length,
    collectionKeys,
    externalIds: entities.map((e) => e.external_id),
  });

  try {
    const records = entities.map((data) => {
      const record: Record<string, unknown> = {
        external_id: data.external_id,
        app_key: data.app_key,
        collection_key: data.collection_key,
        raw_payload: data.raw_payload,
        api_version: data.api_version ?? null,
        archived_at: data.archived_at ?? null,
      };

      // Include custom id if provided (e.g., Notion UUIDs)
      if (data.id) {
        record.id = data.id;
      }

      return record;
    });

    const { data: result, error } = await client
      .from('entities')
      .upsert(records, {
        onConflict: 'app_key,collection_key,external_id',
      })
      .select();

    if (error) {
      debugLog('db', 'Batch upsert failed', {
        count: entities.length,
        error: error.message,
      });
      return { data: null, error: new Error(error.message) };
    }

    debugLog('db', 'Batch upsert succeeded', {
      count: result?.length ?? 0,
    });

    return { data: result as Entity[], error: null };
  } catch (err) {
    debugLog('db', 'Batch upsert exception', {
      count: entities.length,
      error: (err as Error).message,
    });
    return { data: null, error: err as Error };
  }
}

/**
 * Delete an entity by its unique combination of app_key, collection_key, and external_id.
 * This performs a physical deletion of the record.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @param external_id The external provider's ID
 * @returns The number of records deleted (0 or 1)
 */
export async function deleteEntity(
  app_key: string,
  collection_key: string,
  external_id: string,
): Promise<DeleteResult> {
  const client = getSupabaseClient();

  debugLog('db', 'Deleting entity', {
    appKey: app_key,
    collectionKey: collection_key,
    externalId: external_id,
  });

  try {
    const { error, count } = await client
      .from('entities')
      .delete({ count: 'exact' })
      .eq('app_key', app_key)
      .eq('collection_key', collection_key)
      .eq('external_id', external_id);

    if (error) {
      debugLog('db', 'Entity delete failed', {
        externalId: external_id,
        error: error.message,
      });
      return { count: 0, error: new Error(error.message) };
    }

    debugLog('db', 'Entity delete succeeded', {
      externalId: external_id,
      count: count ?? 0,
    });

    return { count: count ?? 0, error: null };
  } catch (err) {
    debugLog('db', 'Entity delete exception', {
      externalId: external_id,
      error: (err as Error).message,
    });
    return { count: 0, error: err as Error };
  }
}

/**
 * Delete all entities for a given app and collection.
 * Useful for full re-sync operations.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type (optional - if omitted, deletes all for app)
 * @returns The number of records deleted
 */
export async function deleteEntities(
  app_key: string,
  collection_key?: string,
): Promise<DeleteResult> {
  const client = getSupabaseClient();

  try {
    let query = client
      .from('entities')
      .delete({ count: 'exact' })
      .eq('app_key', app_key);

    if (collection_key) {
      query = query.eq('collection_key', collection_key);
    }

    const { error, count } = await query;

    if (error) {
      return { count: 0, error: new Error(error.message) };
    }

    return { count: count ?? 0, error: null };
  } catch (err) {
    return { count: 0, error: err as Error };
  }
}

/**
 * Get an entity by its unique combination of app_key, collection_key, and external_id.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @param external_id The external provider's ID
 * @returns The entity if found, null otherwise
 */
export async function getEntity(
  app_key: string,
  collection_key: string,
  external_id: string,
): Promise<{ data: Entity | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('entities')
      .select()
      .eq('app_key', app_key)
      .eq('collection_key', collection_key)
      .eq('external_id', external_id)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Entity | null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get all entity external IDs for a given app and collection.
 * Useful for detecting deletions during full sync.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @returns Set of external IDs
 */
export async function getEntityExternalIds(
  app_key: string,
  collection_key: string,
): Promise<{ data: Set<string> | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('entities')
      .select('external_id')
      .eq('app_key', app_key)
      .eq('collection_key', collection_key);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const ids = new Set((data as Array<{ external_id: string }>).map((e) => e.external_id));
    return { data: ids, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get entity external IDs for records created on or after a given timestamp.
 * The creation timestamp is extracted from the raw_payload 'created' field (Unix timestamp in seconds).
 * Useful for deletion detection when sync_from is configured.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @param createdGte Minimum creation timestamp (Unix seconds)
 * @returns Set of external IDs for records created >= createdGte
 */
export async function getEntityExternalIdsCreatedAfter(
  app_key: string,
  collection_key: string,
  createdGte: number,
): Promise<{ data: Set<string> | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('entities')
      .select('external_id, raw_payload')
      .eq('app_key', app_key)
      .eq('collection_key', collection_key);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Filter entities where raw_payload.created >= createdGte
    const ids = new Set(
      (data as Array<{ external_id: string; raw_payload: Record<string, unknown> }>)
        .filter((e) => {
          const created = e.raw_payload?.created;
          return typeof created === 'number' && created >= createdGte;
        })
        .map((e) => e.external_id),
    );

    return { data: ids, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// =============================================================================
// Sync State Types
// =============================================================================

/**
 * Sync state record as stored in the database
 */
export interface SyncState {
  id: string;
  app_key: string;
  collection_key: string;
  last_synced_at: string;
  last_sync_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Sync State Helper Functions
// =============================================================================

/**
 * Get the sync state for a given app and collection.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @returns The sync state if found, null otherwise
 */
export async function getSyncState(
  app_key: string,
  collection_key: string,
): Promise<{ data: SyncState | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('sync_state')
      .select()
      .eq('app_key', app_key)
      .eq('collection_key', collection_key)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SyncState | null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update the sync state for a given app and collection.
 * Creates the record if it doesn't exist.
 *
 * @param app_key The app instance identifier
 * @param collection_key The collection/resource type
 * @param last_synced_at The timestamp of the last successful sync
 * @param metadata Optional metadata to store (e.g., cursor)
 * @returns The updated sync state
 */
export async function updateSyncState(
  app_key: string,
  collection_key: string,
  last_synced_at: Date,
  metadata?: Record<string, unknown>,
): Promise<{ data: SyncState | null; error: Error | null }> {
  const client = getSupabaseClient();

  debugLog('db', 'Updating sync state', {
    appKey: app_key,
    collectionKey: collection_key,
    lastSyncedAt: last_synced_at.toISOString(),
    hasMetadata: !!metadata,
  });

  try {
    const { data, error } = await client
      .from('sync_state')
      .upsert(
        {
          app_key,
          collection_key,
          last_synced_at: last_synced_at.toISOString(),
          last_sync_metadata: metadata ?? {},
        },
        {
          onConflict: 'app_key,collection_key',
        },
      )
      .select()
      .single();

    if (error) {
      debugLog('db', 'Sync state update failed', {
        appKey: app_key,
        collectionKey: collection_key,
        error: error.message,
      });
      return { data: null, error: new Error(error.message) };
    }

    debugLog('db', 'Sync state update succeeded', {
      appKey: app_key,
      collectionKey: collection_key,
    });

    return { data: data as SyncState, error: null };
  } catch (err) {
    debugLog('db', 'Sync state update exception', {
      appKey: app_key,
      collectionKey: collection_key,
      error: (err as Error).message,
    });
    return { data: null, error: err as Error };
  }
}

/**
 * Get all sync states for a given app.
 *
 * @param app_key The app instance identifier
 * @returns Array of sync states for all collections
 */
export async function getSyncStates(
  app_key: string,
): Promise<{ data: SyncState[] | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('sync_state')
      .select()
      .eq('app_key', app_key);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SyncState[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// =============================================================================
// Webhook Logging Types
// =============================================================================

/**
 * Webhook log entry data for insertion
 */
export interface WebhookLogData {
  app_key?: string;
  request_method: string;
  request_path: string;
  request_headers: Record<string, string>;
  request_body?: Record<string, unknown>;
  response_status: number;
  response_body?: Record<string, unknown>;
  error_message?: string;
  processing_duration_ms?: number;
}

/**
 * Sensitive header names that should be redacted in logs
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-webhook-signature',
  'x-stripe-signature',
  'x-hub-signature',
  'x-hub-signature-256',
  'stripe-signature',
  'cookie',
  'set-cookie',
];

/**
 * Sanitize headers by redacting sensitive values
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// =============================================================================
// Webhook Logging Helper Functions
// =============================================================================

/**
 * Insert a webhook log entry into the database.
 * Sanitizes sensitive headers before storage.
 * Handles errors gracefully to prevent log failures from affecting webhook processing.
 *
 * @param data The webhook log data to insert
 * @returns The inserted log entry or null if insertion failed
 */
export async function insertWebhookLog(
  data: WebhookLogData,
): Promise<{ data: any | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    // Sanitize headers to redact sensitive values
    const sanitizedHeaders = sanitizeHeaders(data.request_headers);

    const record = {
      app_key: data.app_key ?? null,
      request_method: data.request_method,
      request_path: data.request_path,
      request_headers: sanitizedHeaders,
      request_body: data.request_body ?? null,
      response_status: data.response_status,
      response_body: data.response_body ?? null,
      error_message: data.error_message ?? null,
      processing_duration_ms: data.processing_duration_ms ?? null,
    };

    const { data: result, error } = await client
      .from('webhook_logs')
      .insert(record)
      .select()
      .single();

    if (error) {
      // Log the error but don't throw - we don't want logging failures to affect webhook processing
      console.error('Failed to insert webhook log:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: result, error: null };
  } catch (err) {
    // Catch any unexpected errors and log them
    console.error('Unexpected error inserting webhook log:', err);
    return { data: null, error: err as Error };
  }
}

// =============================================================================
// Sync Jobs Types
// =============================================================================

export type SyncJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SyncJobTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Sync job record as stored in the database
 */
export interface SyncJob {
  id: string;
  app_key: string;
  mode: string;
  resource_types: string[] | null;
  status: SyncJobStatus;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  processed_entities: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  /** Flag to trigger worker spawning via pg_net */
  needs_worker: boolean;
  /** Timestamp of last worker spawn attempt */
  worker_spawned_at: string | null;
}

/**
 * Sync job task record as stored in the database
 */
export interface SyncJobTask {
  id: string;
  job_id: string;
  resource_type: string;
  status: SyncJobTaskStatus;
  entity_count: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  /** Pagination cursor for resuming interrupted syncs */
  cursor: string | null;
  /** Last heartbeat timestamp from worker processing this task */
  last_heartbeat: string | null;
}

/**
 * Data required to create a sync job
 */
export interface CreateSyncJobData {
  app_key: string;
  mode: string;
  resource_types?: string[];
}

/**
 * Job status with aggregated statistics
 */
export interface SyncJobStatusWithStats extends SyncJob {
  progress_percentage: number;
  tasks: SyncJobTask[];
}

// =============================================================================
// Sync Jobs Helper Functions
// =============================================================================

/**
 * Create a new sync job and return the created record.
 *
 * @param data The sync job data
 * @returns The created sync job
 */
export async function createSyncJob(
  data: CreateSyncJobData,
): Promise<{ data: SyncJob | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const record = {
      app_key: data.app_key,
      mode: data.mode,
      resource_types: data.resource_types ?? null,
      status: 'pending' as SyncJobStatus,
    };

    const { data: result, error } = await client
      .from('sync_jobs')
      .insert(record)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: result as SyncJob, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a sync job's status and related fields atomically.
 *
 * @param jobId The job ID to update
 * @param updates Partial job data to update
 * @returns The updated sync job
 */
export async function updateJobStatus(
  jobId: string,
  updates: {
    status?: SyncJobStatus;
    completed_tasks?: number;
    failed_tasks?: number;
    processed_entities?: number;
    started_at?: Date;
    completed_at?: Date;
    error_message?: string;
    needs_worker?: boolean;
  },
): Promise<{ data: SyncJob | null; error: Error | null }> {
  const client = getSupabaseClient();

  debugLog('db', 'Updating job status', {
    jobId,
    ...updates,
    started_at: updates.started_at?.toISOString(),
    completed_at: updates.completed_at?.toISOString(),
  });

  try {
    const record: Record<string, unknown> = {};

    if (updates.status !== undefined) record.status = updates.status;
    if (updates.completed_tasks !== undefined) record.completed_tasks = updates.completed_tasks;
    if (updates.failed_tasks !== undefined) record.failed_tasks = updates.failed_tasks;
    if (updates.processed_entities !== undefined) {
      record.processed_entities = updates.processed_entities;
    }
    if (updates.started_at !== undefined) record.started_at = updates.started_at.toISOString();
    if (updates.completed_at !== undefined) {
      record.completed_at = updates.completed_at.toISOString();
    }
    if (updates.error_message !== undefined) record.error_message = updates.error_message;
    if (updates.needs_worker !== undefined) record.needs_worker = updates.needs_worker;

    const { data, error } = await client
      .from('sync_jobs')
      .update(record)
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      debugLog('db', 'Job status update failed', {
        jobId,
        error: error.message,
      });
      return { data: null, error: new Error(error.message) };
    }

    debugLog('db', 'Job status update succeeded', { jobId });

    return { data: data as SyncJob, error: null };
  } catch (err) {
    debugLog('db', 'Job status update exception', {
      jobId,
      error: (err as Error).message,
    });
    return { data: null, error: err as Error };
  }
}

/**
 * Create tasks for a job - one task per resource type.
 *
 * @param jobId The job ID these tasks belong to
 * @param resourceTypes Array of resource types to create tasks for
 * @returns Array of created tasks
 */
export async function createJobTasks(
  jobId: string,
  resourceTypes: string[],
): Promise<{ data: SyncJobTask[] | null; error: Error | null }> {
  if (resourceTypes.length === 0) {
    return { data: [], error: null };
  }

  const client = getSupabaseClient();

  try {
    const records = resourceTypes.map((resourceType) => ({
      job_id: jobId,
      resource_type: resourceType,
      status: 'pending' as SyncJobTaskStatus,
    }));

    const { data, error } = await client
      .from('sync_job_tasks')
      .insert(records)
      .select();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Update the job's total_tasks count
    await client
      .from('sync_jobs')
      .update({ total_tasks: resourceTypes.length })
      .eq('id', jobId);

    return { data: data as SyncJobTask[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Atomically claim a pending task by updating its status to processing.
 * Returns null if no tasks are available or all are claimed.
 *
 * @param jobId The job ID (optional - if not provided, claims from any job)
 * @returns The claimed task or null if none available
 */
export async function claimTask(
  jobId?: string,
): Promise<{ data: SyncJobTask | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    // Find the next pending task (optionally filtered by job)
    let query = client
      .from('sync_job_tasks')
      .select()
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    // Only filter by job_id if provided
    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    const { data: pending, error: findError } = await query.maybeSingle();

    if (findError) {
      return { data: null, error: new Error(findError.message) };
    }

    if (!pending) {
      // No pending tasks available
      return { data: null, error: null };
    }

    // Atomically update the task status to processing
    const { data: claimed, error: updateError } = await client
      .from('sync_job_tasks')
      .update({
        status: 'processing' as SyncJobTaskStatus,
        started_at: new Date().toISOString(),
      })
      .eq('id', pending.id)
      .eq('status', 'pending') // Double-check it's still pending
      .select()
      .maybeSingle();

    if (updateError) {
      return { data: null, error: new Error(updateError.message) };
    }

    if (!claimed) {
      // Task was claimed by another worker
      return { data: null, error: null };
    }

    return { data: claimed as SyncJobTask, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a task's status after processing.
 *
 * @param taskId The task ID
 * @param status New status (completed or failed)
 * @param entityCount Number of entities processed (optional)
 * @param errorMessage Error message if failed (optional)
 * @param cursor Pagination cursor for resuming (optional)
 * @returns The updated task
 */
export async function updateTaskStatus(
  taskId: string,
  status: 'completed' | 'failed',
  entityCount?: number,
  errorMessage?: string,
  cursor?: string | null,
): Promise<{ data: SyncJobTask | null; error: Error | null }> {
  const client = getSupabaseClient();

  debugLog('db', 'Updating task status', {
    taskId,
    status,
    entityCount,
    hasError: !!errorMessage,
    cursor,
  });

  try {
    const updates: Record<string, unknown> = {
      status,
      completed_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
    };

    if (entityCount !== undefined) {
      updates.entity_count = entityCount;
    }

    if (errorMessage !== undefined) {
      updates.error_message = errorMessage;
    }

    if (cursor !== undefined) {
      updates.cursor = cursor;
    }

    const { data, error } = await client
      .from('sync_job_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      debugLog('db', 'Task status update failed', {
        taskId,
        error: error.message,
      });
      return { data: null, error: new Error(error.message) };
    }

    debugLog('db', 'Task status update succeeded', { taskId, status });

    return { data: data as SyncJobTask, error: null };
  } catch (err) {
    debugLog('db', 'Task status update exception', {
      taskId,
      error: (err as Error).message,
    });
    return { data: null, error: err as Error };
  }
}

/**
 * Update a task's heartbeat and optionally cursor during processing.
 * Call this periodically to indicate the worker is still alive.
 *
 * @param taskId The task ID
 * @param cursor Current pagination cursor (optional)
 * @param entityCount Current entity count (optional)
 * @returns The updated task
 */
export async function updateTaskHeartbeat(
  taskId: string,
  cursor?: string | null,
  entityCount?: number,
): Promise<{ data: SyncJobTask | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const updates: Record<string, unknown> = {
      last_heartbeat: new Date().toISOString(),
    };

    if (cursor !== undefined) {
      updates.cursor = cursor;
    }

    if (entityCount !== undefined) {
      updates.entity_count = entityCount;
    }

    const { data, error } = await client
      .from('sync_job_tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as SyncJobTask, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get job status with aggregated task statistics and progress.
 *
 * @param jobId The job ID
 * @returns Job with progress percentage and tasks
 */
export async function getJobStatus(
  jobId: string,
): Promise<{ data: SyncJobStatusWithStats | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    // Get job data
    const { data: job, error: jobError } = await client
      .from('sync_jobs')
      .select()
      .eq('id', jobId)
      .maybeSingle();

    if (jobError) {
      return { data: null, error: new Error(jobError.message) };
    }

    if (!job) {
      return { data: null, error: null };
    }

    // Get all tasks for this job
    const { data: tasks, error: tasksError } = await client
      .from('sync_job_tasks')
      .select()
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (tasksError) {
      return { data: null, error: new Error(tasksError.message) };
    }

    const typedJob = job as SyncJob;
    const typedTasks = (tasks || []) as SyncJobTask[];

    // Calculate progress percentage
    const progress_percentage = typedJob.total_tasks > 0
      ? Math.round(
        ((typedJob.completed_tasks + typedJob.failed_tasks) / typedJob.total_tasks) * 100,
      )
      : 0;

    const result: SyncJobStatusWithStats = {
      ...typedJob,
      progress_percentage,
      tasks: typedTasks,
    };

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete completed or failed jobs older than the specified retention period.
 * Default retention is 7 days.
 *
 * @param retentionDays Number of days to retain jobs (default: 7)
 * @returns Number of jobs deleted
 */
export async function cleanupOldJobs(
  retentionDays = 7,
): Promise<{ count: number; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { count, error } = await client
      .from('sync_jobs')
      .delete({ count: 'exact' })
      .in('status', ['completed', 'failed'])
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      return { count: 0, error: new Error(error.message) };
    }

    return { count: count ?? 0, error: null };
  } catch (err) {
    return { count: 0, error: err as Error };
  }
}
