-- ============================================================================
-- Intercom Connector Migrations
-- ============================================================================
-- This file contains all database objects required by the Intercom connector.
-- It is assembled into the main migrations by scripts/assemble-migrations.ts
-- when the Intercom connector is configured in supasaasy.config.ts.
--
-- All statements must be idempotent (CREATE OR REPLACE, IF NOT EXISTS, etc.)
-- to support re-running the assembly process safely.
-- ============================================================================

-- ============================================================================
-- Helper Function for Timestamp Parsing
-- ============================================================================
-- Intercom API can return timestamps as either Unix epoch (numeric) or ISO 8601 strings.
-- This function handles both formats gracefully.

CREATE OR REPLACE FUNCTION supasaasy.parse_intercom_timestamp(ts_value text)
RETURNS timestamptz AS $$
BEGIN
    IF ts_value IS NULL OR ts_value = '' THEN
        RETURN NULL;
    END IF;
    
    -- Check if the value is numeric (Unix timestamp, possibly with decimals)
    IF ts_value ~ '^[0-9]+\.?[0-9]*$' THEN
        RETURN to_timestamp(ts_value::double precision);
    END IF;
    
    -- Otherwise, assume ISO 8601 format
    RETURN ts_value::timestamptz;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION supasaasy.parse_intercom_timestamp(text) IS 'Parse Intercom timestamps that may be either Unix epoch or ISO 8601 format';

-- ============================================================================
-- Companies View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.intercom_companies
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'company_id' AS company_id,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'industry' AS industry,
    (e.raw_payload->>'size')::int AS size,
    e.raw_payload->>'website' AS website,
    (e.raw_payload->>'monthly_spend')::numeric AS monthly_spend,
    (e.raw_payload->>'session_count')::int AS session_count,
    (e.raw_payload->>'user_count')::int AS user_count,
    e.raw_payload->'plan'->>'name' AS plan_name,
    e.raw_payload->'custom_attributes' AS custom_attributes,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'created_at') AS intercom_created_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'updated_at') AS intercom_updated_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'remote_created_at') AS remote_created_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'intercom_company'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.intercom_companies IS 'Convenience view for Intercom companies with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Contacts View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.intercom_contacts
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'external_id' AS contact_external_id,
    e.raw_payload->>'email' AS email,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'phone' AS phone,
    e.raw_payload->>'role' AS role,
    e.raw_payload->>'avatar' AS avatar,
    (e.raw_payload->>'owner_id')::int AS owner_id,
    (e.raw_payload->>'has_hard_bounced')::boolean AS has_hard_bounced,
    (e.raw_payload->>'marked_email_as_spam')::boolean AS marked_email_as_spam,
    (e.raw_payload->>'unsubscribed_from_emails')::boolean AS unsubscribed_from_emails,
    e.raw_payload->>'browser' AS browser,
    e.raw_payload->>'browser_language' AS browser_language,
    e.raw_payload->>'os' AS os,
    e.raw_payload->>'language_override' AS language_override,
    e.raw_payload->'location'->>'country' AS country,
    e.raw_payload->'location'->>'region' AS region,
    e.raw_payload->'location'->>'city' AS city,
    e.raw_payload->'custom_attributes' AS custom_attributes,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'created_at') AS intercom_created_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'updated_at') AS intercom_updated_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'signed_up_at') AS signed_up_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'last_seen_at') AS last_seen_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'last_replied_at') AS last_replied_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'last_contacted_at') AS last_contacted_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'intercom_contact'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.intercom_contacts IS 'Convenience view for Intercom contacts with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Admins View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.intercom_admins
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'email' AS email,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'job_title' AS job_title,
    (e.raw_payload->>'away_mode_enabled')::boolean AS away_mode_enabled,
    (e.raw_payload->>'away_mode_reassign')::boolean AS away_mode_reassign,
    (e.raw_payload->>'has_inbox_seat')::boolean AS has_inbox_seat,
    e.raw_payload->'avatar'->>'image_url' AS avatar_url,
    e.raw_payload->'team_ids' AS team_ids,
    e.created_at,
    e.updated_at
FROM supasaasy.entities e
WHERE e.collection_key = 'intercom_admin'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.intercom_admins IS 'Convenience view for Intercom admins with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Conversations View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.intercom_conversations
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'title' AS title,
    e.raw_payload->>'state' AS state,
    (e.raw_payload->>'open')::boolean AS open,
    e.raw_payload->>'priority' AS priority,
    (e.raw_payload->>'admin_assignee_id')::int AS admin_assignee_id,
    e.raw_payload->>'team_assignee_id' AS team_assignee_id,
    (e.raw_payload->>'read')::boolean AS read,
    e.raw_payload->'conversation_rating'->>'rating' AS rating,
    e.raw_payload->'conversation_rating'->>'remark' AS rating_remark,
    e.raw_payload->'source'->>'type' AS source_type,
    e.raw_payload->'source'->>'delivered_as' AS source_delivered_as,
    e.raw_payload->'source'->>'subject' AS source_subject,
    e.raw_payload->'source'->'author'->>'type' AS source_author_type,
    e.raw_payload->'source'->'author'->>'id' AS source_author_id,
    e.raw_payload->'statistics'->>'count_conversation_parts' AS parts_count,
    e.raw_payload->'statistics'->>'count_reopens' AS reopens_count,
    e.raw_payload->'statistics'->>'count_assignments' AS assignments_count,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'created_at') AS intercom_created_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'updated_at') AS intercom_updated_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'waiting_since') AS waiting_since,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'snoozed_until') AS snoozed_until,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'intercom_conversation'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.intercom_conversations IS 'Convenience view for Intercom conversations with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Conversation Parts View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.intercom_conversation_parts
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'conversation_id' AS conversation_id,
    e.raw_payload->>'part_type' AS part_type,
    e.raw_payload->>'body' AS body,
    e.raw_payload->'author'->>'type' AS author_type,
    e.raw_payload->'author'->>'id' AS author_id,
    e.raw_payload->'author'->>'name' AS author_name,
    e.raw_payload->'author'->>'email' AS author_email,
    e.raw_payload->'assigned_to'->>'type' AS assigned_to_type,
    e.raw_payload->'assigned_to'->>'id' AS assigned_to_id,
    (e.raw_payload->>'redacted')::boolean AS redacted,
    e.raw_payload->'attachments' AS attachments,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'created_at') AS intercom_created_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'updated_at') AS intercom_updated_at,
    supasaasy.parse_intercom_timestamp(e.raw_payload->>'notified_at') AS notified_at,
    e.created_at,
    e.updated_at
FROM supasaasy.entities e
WHERE e.collection_key = 'intercom_conversation_part'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.intercom_conversation_parts IS 'Convenience view for Intercom conversation parts with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Indexes for View Performance
-- ============================================================================

-- Index for email lookups on contacts
CREATE INDEX IF NOT EXISTS idx_entities_intercom_contact_email
ON supasaasy.entities ((raw_payload->>'email'))
WHERE collection_key = 'intercom_contact' AND deleted_at IS NULL;

-- Index for external_id lookups on contacts (for syncing with external systems)
CREATE INDEX IF NOT EXISTS idx_entities_intercom_contact_external_id
ON supasaasy.entities ((raw_payload->>'external_id'))
WHERE collection_key = 'intercom_contact' AND deleted_at IS NULL;

-- Index for company_id lookups
CREATE INDEX IF NOT EXISTS idx_entities_intercom_company_company_id
ON supasaasy.entities ((raw_payload->>'company_id'))
WHERE collection_key = 'intercom_company' AND deleted_at IS NULL;

-- Index for conversation state filtering
CREATE INDEX IF NOT EXISTS idx_entities_intercom_conversation_state
ON supasaasy.entities ((raw_payload->>'state'))
WHERE collection_key = 'intercom_conversation' AND deleted_at IS NULL;

-- Index for conversation admin assignee
CREATE INDEX IF NOT EXISTS idx_entities_intercom_conversation_admin_assignee
ON supasaasy.entities (((raw_payload->>'admin_assignee_id')::int))
WHERE collection_key = 'intercom_conversation' AND deleted_at IS NULL;

-- Index for conversation parts by conversation_id
CREATE INDEX IF NOT EXISTS idx_entities_intercom_part_conversation_id
ON supasaasy.entities ((raw_payload->>'conversation_id'))
WHERE collection_key = 'intercom_conversation_part' AND deleted_at IS NULL;
