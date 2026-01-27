/**
 * Database Utilities
 *
 * Provides database connection and helper functions for Edge Functions.
 */
// deno-lint-ignore-file no-explicit-any

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
    throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
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
 * Execute a query within the supasaasy schema
 */
export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<{ data: T[] | null; error: Error | null }> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client.rpc('exec_sql', {
      query: sql,
      params: params || [],
    });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as T[], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
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

    // Perform the upsert using the unique constraint
    const { data: result, error } = await client
      .from('entities')
      .upsert(
        {
          external_id: data.external_id,
          app_key: data.app_key,
          collection_key: data.collection_key,
          raw_payload: data.raw_payload,
          api_version: data.api_version ?? null,
          archived_at: data.archived_at ?? null,
        },
        {
          onConflict: 'app_key,collection_key,external_id',
        }
      )
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message), created: false };
    }

    return { data: result as Entity, error: null, created: isCreate };
  } catch (err) {
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
  entities: UpsertEntityData[]
): Promise<{ data: Entity[] | null; error: Error | null }> {
  if (entities.length === 0) {
    return { data: [], error: null };
  }

  const client = getSupabaseClient();

  try {
    const records = entities.map((data) => ({
      external_id: data.external_id,
      app_key: data.app_key,
      collection_key: data.collection_key,
      raw_payload: data.raw_payload,
      api_version: data.api_version ?? null,
      archived_at: data.archived_at ?? null,
    }));

    const { data: result, error } = await client
      .from('entities')
      .upsert(records, {
        onConflict: 'app_key,collection_key,external_id',
      })
      .select();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: result as Entity[], error: null };
  } catch (err) {
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
  external_id: string
): Promise<DeleteResult> {
  const client = getSupabaseClient();

  try {
    const { error, count } = await client
      .from('entities')
      .delete({ count: 'exact' })
      .eq('app_key', app_key)
      .eq('collection_key', collection_key)
      .eq('external_id', external_id);

    if (error) {
      return { count: 0, error: new Error(error.message) };
    }

    return { count: count ?? 0, error: null };
  } catch (err) {
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
  collection_key?: string
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
  external_id: string
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
