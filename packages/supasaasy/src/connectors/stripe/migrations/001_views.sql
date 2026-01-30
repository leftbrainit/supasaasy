-- ============================================================================
-- Stripe Connector Migrations
-- ============================================================================
-- This file contains all database objects required by the Stripe connector.
-- It is assembled into the main migrations by scripts/assemble-migrations.ts
-- when the Stripe connector is configured in supasaasy.config.ts.
--
-- All statements must be idempotent (CREATE OR REPLACE, IF NOT EXISTS, etc.)
-- to support re-running the assembly process safely.
-- ============================================================================

-- ============================================================================
-- Customers View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_customers
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'email' AS email,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'description' AS description,
    e.raw_payload->'metadata' AS metadata,
    e.raw_payload->>'phone' AS phone,
    e.raw_payload->>'currency' AS currency,
    e.raw_payload->'address' AS address,
    (e.raw_payload->>'livemode')::boolean AS livemode,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_customer'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_customers IS 'Convenience view for Stripe customers with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Products View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_products
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'name' AS name,
    e.raw_payload->>'description' AS description,
    (e.raw_payload->>'active')::boolean AS active,
    e.raw_payload->'metadata' AS metadata,
    e.raw_payload->'images' AS images,
    e.raw_payload->>'default_price' AS default_price_id,
    e.raw_payload->>'type' AS product_type,
    (e.raw_payload->>'livemode')::boolean AS livemode,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    to_timestamp((e.raw_payload->>'updated')::bigint) AS stripe_updated_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_product'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_products IS 'Convenience view for Stripe products with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Prices View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_prices
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'product' AS product_id,
    (e.raw_payload->>'unit_amount')::bigint AS unit_amount,
    (e.raw_payload->>'unit_amount_decimal')::numeric AS unit_amount_decimal,
    e.raw_payload->>'currency' AS currency,
    (e.raw_payload->>'active')::boolean AS active,
    e.raw_payload->>'type' AS price_type,
    e.raw_payload->>'billing_scheme' AS billing_scheme,
    e.raw_payload->>'nickname' AS nickname,
    e.raw_payload->'recurring' AS recurring,
    e.raw_payload->'recurring'->>'interval' AS recurring_interval,
    (e.raw_payload->'recurring'->>'interval_count')::int AS recurring_interval_count,
    e.raw_payload->'metadata' AS metadata,
    (e.raw_payload->>'livemode')::boolean AS livemode,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_price'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_prices IS 'Convenience view for Stripe prices with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Plans View (Legacy)
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_plans
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'product' AS product_id,
    (e.raw_payload->>'amount')::bigint AS amount,
    (e.raw_payload->>'amount_decimal')::numeric AS amount_decimal,
    e.raw_payload->>'currency' AS currency,
    (e.raw_payload->>'active')::boolean AS active,
    e.raw_payload->>'interval' AS interval,
    (e.raw_payload->>'interval_count')::int AS interval_count,
    e.raw_payload->>'nickname' AS nickname,
    (e.raw_payload->>'trial_period_days')::int AS trial_period_days,
    e.raw_payload->'metadata' AS metadata,
    (e.raw_payload->>'livemode')::boolean AS livemode,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_plan'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_plans IS 'Convenience view for Stripe plans (legacy) with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Subscriptions View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_subscriptions
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'customer' AS customer_id,
    e.raw_payload->>'status' AS status,
    to_timestamp((e.raw_payload->>'current_period_start')::bigint) AS current_period_start,
    to_timestamp((e.raw_payload->>'current_period_end')::bigint) AS current_period_end,
    to_timestamp((e.raw_payload->>'start_date')::bigint) AS start_date,
    to_timestamp((e.raw_payload->>'ended_at')::bigint) AS ended_at,
    to_timestamp((e.raw_payload->>'canceled_at')::bigint) AS canceled_at,
    to_timestamp((e.raw_payload->>'trial_start')::bigint) AS trial_start,
    to_timestamp((e.raw_payload->>'trial_end')::bigint) AS trial_end,
    (e.raw_payload->>'cancel_at_period_end')::boolean AS cancel_at_period_end,
    e.raw_payload->>'default_payment_method' AS default_payment_method,
    e.raw_payload->>'collection_method' AS collection_method,
    e.raw_payload->'metadata' AS metadata,
    (e.raw_payload->>'livemode')::boolean AS livemode,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    e.created_at,
    e.updated_at,
    e.archived_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_subscription'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_subscriptions IS 'Convenience view for Stripe subscriptions with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Subscription Items View
-- ============================================================================

CREATE OR REPLACE VIEW supasaasy.stripe_subscription_items
WITH (security_invoker = true) AS
SELECT
    e.id,
    e.external_id,
    e.app_key,
    e.raw_payload->>'subscription' AS subscription_id,
    e.raw_payload->>'price' AS price_id,
    e.raw_payload->'price'->>'id' AS price_external_id,
    (e.raw_payload->>'quantity')::int AS quantity,
    e.raw_payload->'metadata' AS metadata,
    to_timestamp((e.raw_payload->>'created')::bigint) AS stripe_created_at,
    e.created_at,
    e.updated_at
FROM supasaasy.entities e
WHERE e.collection_key = 'stripe_subscription_item'
  AND e.deleted_at IS NULL;

COMMENT ON VIEW supasaasy.stripe_subscription_items IS 'Convenience view for Stripe subscription items with commonly used fields extracted from raw_payload';

-- ============================================================================
-- Indexes for View Performance
-- ============================================================================

-- Index for filtering by collection_key (used by all views)
CREATE INDEX IF NOT EXISTS idx_entities_collection_key_app_key
ON supasaasy.entities (collection_key, app_key)
WHERE deleted_at IS NULL;

-- Index for email lookups on customers
CREATE INDEX IF NOT EXISTS idx_entities_stripe_customer_email
ON supasaasy.entities ((raw_payload->>'email'))
WHERE collection_key = 'stripe_customer' AND deleted_at IS NULL;

-- Index for customer ID lookups on subscriptions
CREATE INDEX IF NOT EXISTS idx_entities_stripe_subscription_customer
ON supasaasy.entities ((raw_payload->>'customer'))
WHERE collection_key = 'stripe_subscription' AND deleted_at IS NULL;

-- Index for subscription status filtering
CREATE INDEX IF NOT EXISTS idx_entities_stripe_subscription_status
ON supasaasy.entities ((raw_payload->>'status'))
WHERE collection_key = 'stripe_subscription' AND deleted_at IS NULL;

-- Index for product ID lookups on prices
CREATE INDEX IF NOT EXISTS idx_entities_stripe_price_product
ON supasaasy.entities ((raw_payload->>'product'))
WHERE collection_key = 'stripe_price' AND deleted_at IS NULL;

-- Index for active/inactive filtering on products
CREATE INDEX IF NOT EXISTS idx_entities_stripe_product_active
ON supasaasy.entities (((raw_payload->>'active')::boolean))
WHERE collection_key = 'stripe_product' AND deleted_at IS NULL;
