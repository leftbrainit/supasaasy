-- ============================================================================
-- Notion Connector Migrations
-- ============================================================================
-- This file contains all database objects required by the Notion connector.
-- It is assembled into the main migrations by scripts/assemble-migrations.ts
-- when the Notion connector is configured in supasaasy.config.ts.
--
-- All statements must be idempotent (CREATE OR REPLACE, IF NOT EXISTS, etc.)
-- to support re-running the assembly process safely.
-- ============================================================================

-- ============================================================================
-- Data Sources View
-- ============================================================================
-- View for Notion data sources (tables within databases)

CREATE OR REPLACE VIEW supasaasy.notion_data_sources
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    -- Extract title from the title array
    (
        SELECT string_agg(item->>'plain_text', '')
        FROM jsonb_array_elements(e.raw_payload->'title') AS item
    ) AS title,
    (e.raw_payload->>'archived')::boolean AS archived,
    (e.raw_payload->>'in_trash')::boolean AS in_trash,
    e.raw_payload->>'url' AS url,
    e.raw_payload->>'public_url' AS public_url,
    e.raw_payload->'icon' AS icon,
    e.raw_payload->'cover' AS cover,
    e.raw_payload->'created_by'->>'id' AS created_by_id,
    e.raw_payload->'last_edited_by'->>'id' AS last_edited_by_id,
    (e.raw_payload->>'created_time')::timestamptz AS notion_created_at,
    (e.raw_payload->>'last_edited_time')::timestamptz AS notion_last_edited_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'notion_data_source'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.notion_data_sources IS 'Convenience view for Notion data sources with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Data Source Properties View
-- ============================================================================
-- View for Notion data source properties (schema definition)

CREATE OR REPLACE VIEW supasaasy.notion_data_source_properties
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'data_source_id' AS data_source_id,
    e.raw_payload->>'property_id' AS property_id,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'type' AS type,
    e.raw_payload->'config' AS config,
    e.created_at,
    e.updated_at
FROM supasaasy.entities e
WHERE e.collection_key = 'notion_data_source_property'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.notion_data_source_properties IS 'Convenience view for Notion data source properties (schema) with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Pages View
-- ============================================================================
-- View for Notion pages (database rows/items)

CREATE OR REPLACE VIEW supasaasy.notion_pages
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    -- Extract data source ID from parent
    e.raw_payload->'parent'->>'data_source_id' AS data_source_id,
    -- Extract title from the title property (find the property with type 'title')
    (
        SELECT string_agg(item->>'plain_text', '')
        FROM jsonb_each(e.raw_payload->'properties') AS prop(key, val),
        LATERAL jsonb_array_elements(val->'title') AS item
        WHERE val->>'type' = 'title'
        LIMIT 1
    ) AS title,
    (e.raw_payload->>'archived')::boolean AS archived,
    (e.raw_payload->>'in_trash')::boolean AS in_trash,
    e.raw_payload->>'url' AS url,
    e.raw_payload->>'public_url' AS public_url,
    e.raw_payload->'icon' AS icon,
    e.raw_payload->'cover' AS cover,
    e.raw_payload->'properties' AS properties,
    e.raw_payload->'created_by'->>'id' AS created_by_id,
    e.raw_payload->'last_edited_by'->>'id' AS last_edited_by_id,
    (e.raw_payload->>'created_time')::timestamptz AS notion_created_at,
    (e.raw_payload->>'last_edited_time')::timestamptz AS notion_last_edited_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'notion_page'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.notion_pages IS 'Convenience view for Notion pages with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Users View
-- ============================================================================
-- View for Notion workspace users (people and bots)

CREATE OR REPLACE VIEW supasaasy.notion_users
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'avatar_url' AS avatar_url,
    e.raw_payload->>'type' AS type,
    -- Email is only available for 'person' type users
    e.raw_payload->'person'->>'email' AS email,
    -- Bot-specific fields
    e.raw_payload->'bot'->'owner'->>'type' AS bot_owner_type,
    e.raw_payload->'bot'->>'workspace_name' AS bot_workspace_name,
    e.created_at,
    e.updated_at
FROM supasaasy.entities e
WHERE e.collection_key = 'notion_user'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.notion_users IS 'Convenience view for Notion users with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Indexes for View Performance
-- ============================================================================


-- Index for data source archived state filtering
CREATE INDEX IF NOT EXISTS idx_entities_notion_data_source_archived
ON supasaasy.entities (((raw_payload->>'archived')::boolean))
WHERE collection_key = 'notion_data_source' AND deleted_at IS NULL;

-- Index for property lookups by data source
CREATE INDEX IF NOT EXISTS idx_entities_notion_property_data_source
ON supasaasy.entities ((raw_payload->>'data_source_id'))
WHERE collection_key = 'notion_data_source_property' AND deleted_at IS NULL;

-- Index for property lookups by type
CREATE INDEX IF NOT EXISTS idx_entities_notion_property_type
ON supasaasy.entities ((raw_payload->>'type'))
WHERE collection_key = 'notion_data_source_property' AND deleted_at IS NULL;

-- Index for page lookups by data source (parent database)
CREATE INDEX IF NOT EXISTS idx_entities_notion_page_data_source
ON supasaasy.entities ((raw_payload->'parent'->>'data_source_id'))
WHERE collection_key = 'notion_page' AND deleted_at IS NULL;

-- Index for page archived state filtering
CREATE INDEX IF NOT EXISTS idx_entities_notion_page_archived
ON supasaasy.entities (((raw_payload->>'archived')::boolean))
WHERE collection_key = 'notion_page' AND deleted_at IS NULL;

-- Note: Index on last_edited_time omitted because ::timestamptz cast is not IMMUTABLE.
-- Incremental sync queries will still work but may be slower on large datasets.

-- Index for user type filtering
CREATE INDEX IF NOT EXISTS idx_entities_notion_user_type
ON supasaasy.entities ((raw_payload->>'type'))
WHERE collection_key = 'notion_user' AND deleted_at IS NULL;

-- Index for user email lookups (for person type users)
CREATE INDEX IF NOT EXISTS idx_entities_notion_user_email
ON supasaasy.entities ((raw_payload->'person'->>'email'))
WHERE collection_key = 'notion_user' AND deleted_at IS NULL;
