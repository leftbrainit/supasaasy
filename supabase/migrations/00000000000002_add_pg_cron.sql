-- SupaSaaSy pg_cron Migration
-- Enables the pg_cron extension for scheduled sync jobs

-- =============================================================================
-- Enable pg_cron Extension
-- =============================================================================
-- Note: pg_cron must be enabled by a superuser and is typically done via
-- the Supabase dashboard or by contacting support for hosted instances.
-- This migration documents the required setup.

-- Attempt to enable pg_cron (will fail if not available in the database)
-- On Supabase, enable this via: Dashboard > Database > Extensions > pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- =============================================================================
-- Grant Permissions
-- =============================================================================
-- Allow the service role to schedule jobs

GRANT USAGE ON SCHEMA cron TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON cron.job TO service_role;

-- =============================================================================
-- Schedule Management Functions
-- =============================================================================

-- Function to create or update a sync schedule for an app instance
CREATE OR REPLACE FUNCTION supasaasy.upsert_sync_schedule(
  p_app_key TEXT,
  p_schedule TEXT,  -- Cron expression (e.g., '0 * * * *' for hourly)
  p_enabled BOOLEAN DEFAULT true
)
RETURNS BIGINT AS $$
DECLARE
  v_job_name TEXT;
  v_job_id BIGINT;
  v_existing_job_id BIGINT;
BEGIN
  -- Generate unique job name
  v_job_name := 'supasaasy_sync_' || p_app_key;
  
  -- Check if job already exists
  SELECT jobid INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = v_job_name;
  
  -- Remove existing job if present
  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;
  
  -- Create new job if enabled
  IF p_enabled THEN
    -- Schedule the sync function to be called via HTTP
    -- The actual URL will be configured based on the deployment
    SELECT cron.schedule(
      v_job_name,
      p_schedule,
      format(
        'SELECT net.http_post(
          url := current_setting(''app.settings.supabase_functions_url'') || ''/sync'',
          headers := jsonb_build_object(
            ''Content-Type'', ''application/json'',
            ''Authorization'', ''Bearer '' || current_setting(''app.settings.admin_api_key'')
          ),
          body := jsonb_build_object(
            ''app_key'', %L,
            ''mode'', ''incremental''
          )
        )',
        p_app_key
      )
    ) INTO v_job_id;
    
    RETURN v_job_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a sync schedule for an app instance
CREATE OR REPLACE FUNCTION supasaasy.remove_sync_schedule(p_app_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_job_name TEXT;
  v_job_id BIGINT;
BEGIN
  v_job_name := 'supasaasy_sync_' || p_app_key;
  
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = v_job_name;
  
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list all sync schedules
CREATE OR REPLACE FUNCTION supasaasy.list_sync_schedules()
RETURNS TABLE (
  job_id BIGINT,
  app_key TEXT,
  schedule TEXT,
  active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobid,
    substring(j.jobname from 'supasaasy_sync_(.*)') as app_key,
    j.schedule,
    j.active
  FROM cron.job j
  WHERE j.jobname LIKE 'supasaasy_sync_%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on management functions
GRANT EXECUTE ON FUNCTION supasaasy.upsert_sync_schedule(TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION supasaasy.remove_sync_schedule(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION supasaasy.list_sync_schedules() TO service_role;

COMMENT ON FUNCTION supasaasy.upsert_sync_schedule IS 'Create or update a periodic sync schedule for an app instance';
COMMENT ON FUNCTION supasaasy.remove_sync_schedule IS 'Remove a periodic sync schedule for an app instance';
COMMENT ON FUNCTION supasaasy.list_sync_schedules IS 'List all configured sync schedules';
