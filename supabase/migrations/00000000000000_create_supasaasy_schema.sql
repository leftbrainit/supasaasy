-- SupaSaaSy Initial Migration
-- Creates the supasaasy schema and canonical entities table

-- Create the supasaasy schema
CREATE SCHEMA IF NOT EXISTS supasaasy;

-- Grant usage to authenticated and service_role
GRANT USAGE ON SCHEMA supasaasy TO authenticated;
GRANT USAGE ON SCHEMA supasaasy TO service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA supasaasy
GRANT SELECT ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA supasaasy
GRANT ALL ON TABLES TO service_role;

-- Comment on schema
COMMENT ON SCHEMA supasaasy IS 'SupaSaaSy data sync framework schema';

-- =============================================================================
-- Canonical Entities Table
-- =============================================================================
-- Stores all SaaS data in a unified format. The unique constraint on
-- (app_key, collection_key, external_id) enables idempotent sync operations.

CREATE TABLE supasaasy.entities (
  -- Primary key: auto-generated UUID
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- External provider's ID for this entity
  external_id TEXT NOT NULL,
  
  -- App instance identifier (e.g., 'stripe_production', 'shopify_store_1')
  app_key TEXT NOT NULL,
  
  -- Collection/resource type (e.g., 'customers', 'subscriptions', 'orders')
  collection_key TEXT NOT NULL,
  
  -- Upstream API version for future schema migration handling
  api_version TEXT,
  
  -- Complete API response stored as JSONB for flexible querying
  raw_payload JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,  -- Set when entity is soft-deleted upstream
  deleted_at TIMESTAMPTZ    -- Set when entity is hard-deleted upstream
);

-- Comment on table and columns
COMMENT ON TABLE supasaasy.entities IS 'Canonical storage for all synced SaaS entities';
COMMENT ON COLUMN supasaasy.entities.id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN supasaasy.entities.external_id IS 'Provider''s unique identifier for this entity';
COMMENT ON COLUMN supasaasy.entities.app_key IS 'SupaSaaSy app instance identifier';
COMMENT ON COLUMN supasaasy.entities.collection_key IS 'Resource type (e.g., customers, orders)';
COMMENT ON COLUMN supasaasy.entities.api_version IS 'Upstream API version at sync time';
COMMENT ON COLUMN supasaasy.entities.raw_payload IS 'Complete API response as JSONB';
COMMENT ON COLUMN supasaasy.entities.archived_at IS 'Timestamp when entity was soft-deleted upstream';
COMMENT ON COLUMN supasaasy.entities.deleted_at IS 'Timestamp when entity was hard-deleted upstream';

-- =============================================================================
-- Unique Constraint for Idempotency
-- =============================================================================
-- Ensures each external entity is stored exactly once per app and collection.
-- This constraint is used for upsert conflict resolution.

ALTER TABLE supasaasy.entities
ADD CONSTRAINT entities_app_collection_external_unique
UNIQUE (app_key, collection_key, external_id);

-- =============================================================================
-- Indexes for Query Performance
-- =============================================================================

-- Index for filtering by app instance
CREATE INDEX idx_entities_app_key ON supasaasy.entities (app_key);

-- Index for filtering by collection/resource type
CREATE INDEX idx_entities_collection_key ON supasaasy.entities (collection_key);

-- Index for lookups by external ID
CREATE INDEX idx_entities_external_id ON supasaasy.entities (external_id);

-- Composite index for common query pattern: filter by app and collection
CREATE INDEX idx_entities_app_collection ON supasaasy.entities (app_key, collection_key);

-- Index for sync ordering (most recently updated first)
CREATE INDEX idx_entities_updated_at ON supasaasy.entities (updated_at DESC);

-- =============================================================================
-- Timestamp Auto-Update Trigger
-- =============================================================================

-- Function to update the updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION supasaasy.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on entity modifications
CREATE TRIGGER entities_update_updated_at
  BEFORE UPDATE ON supasaasy.entities
  FOR EACH ROW
  EXECUTE FUNCTION supasaasy.update_updated_at_column();

-- Grant permissions on the entities table
GRANT SELECT ON supasaasy.entities TO authenticated;
GRANT ALL ON supasaasy.entities TO service_role;
