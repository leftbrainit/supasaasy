-- SupaSaaSy Sync State Migration
-- Creates the sync_state table for tracking incremental sync progress

-- =============================================================================
-- Sync State Table
-- =============================================================================
-- Tracks the last successful sync timestamp per (app_key, collection_key)
-- to enable incremental sync operations.

CREATE TABLE supasaasy.sync_state (
  -- Primary key: auto-generated UUID
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- App instance identifier (e.g., 'stripe_production')
  app_key TEXT NOT NULL,
  
  -- Collection/resource type (e.g., 'customers', 'subscriptions')
  collection_key TEXT NOT NULL,
  
  -- Timestamp of the last successful sync for this collection
  last_synced_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata from the last sync (e.g., cursor, page token)
  last_sync_metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comment on table and columns
COMMENT ON TABLE supasaasy.sync_state IS 'Tracks last successful sync timestamp per app and collection';
COMMENT ON COLUMN supasaasy.sync_state.app_key IS 'SupaSaaSy app instance identifier';
COMMENT ON COLUMN supasaasy.sync_state.collection_key IS 'Resource type being synced';
COMMENT ON COLUMN supasaasy.sync_state.last_synced_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN supasaasy.sync_state.last_sync_metadata IS 'Additional sync metadata (cursors, etc.)';

-- =============================================================================
-- Unique Constraint for State Tracking
-- =============================================================================
-- Ensures only one sync state record exists per (app_key, collection_key).

ALTER TABLE supasaasy.sync_state
ADD CONSTRAINT sync_state_app_collection_unique
UNIQUE (app_key, collection_key);

-- =============================================================================
-- Indexes for Query Performance
-- =============================================================================

-- Index for filtering by app instance
CREATE INDEX idx_sync_state_app_key ON supasaasy.sync_state (app_key);

-- =============================================================================
-- Timestamp Auto-Update Trigger
-- =============================================================================

-- Trigger to auto-update updated_at on sync state modifications
CREATE TRIGGER sync_state_update_updated_at
  BEFORE UPDATE ON supasaasy.sync_state
  FOR EACH ROW
  EXECUTE FUNCTION supasaasy.update_updated_at_column();

-- Grant permissions on the sync_state table
GRANT SELECT ON supasaasy.sync_state TO authenticated;
GRANT ALL ON supasaasy.sync_state TO service_role;
