/**
 * Database Utilities
 *
 * Provides database connection and helper functions for Edge Functions.
 */

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

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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
