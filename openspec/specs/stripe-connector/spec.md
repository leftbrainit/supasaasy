# stripe-connector Specification

## Purpose

TBD - created by archiving change 06-add-stripe-connector. Update Purpose after archive.

## Requirements

### Requirement: Stripe Connector Registration

The Stripe connector SHALL be registered with the connector registry.

#### Scenario: Connector available by provider name

- **WHEN** `getConnector("stripe")` is called
- **THEN** the Stripe connector SHALL be returned

#### Scenario: Metadata includes supported resources

- **WHEN** the Stripe connector metadata is queried
- **THEN** it SHALL list: customer, product, price, plan, subscription, subscription_item

### Requirement: Stripe Webhook Verification

The Stripe connector SHALL verify webhook signatures using the Stripe SDK.

#### Scenario: Valid Stripe signature accepted

- **WHEN** a webhook with valid Stripe-Signature header is received
- **THEN** verification SHALL pass
- **AND** the event SHALL be processed

#### Scenario: Invalid signature rejected

- **WHEN** a webhook with invalid or missing Stripe-Signature header is received
- **THEN** verification SHALL fail
- **AND** 401 Unauthorized SHALL be returned

#### Scenario: Webhook secret per app instance

- **WHEN** multiple Stripe instances are configured
- **THEN** each MAY have its own webhook signing secret
- **AND** the correct secret SHALL be used based on `app_key`

### Requirement: Stripe Customer Sync

The Stripe connector SHALL sync Customer resources.

#### Scenario: Customer created via webhook

- **WHEN** a `customer.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "stripe_customer"`

#### Scenario: Customer updated via webhook

- **WHEN** a `customer.updated` webhook is received
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Customer deleted via webhook

- **WHEN** a `customer.deleted` webhook is received
- **THEN** the entity SHALL be physically deleted

#### Scenario: Customer full sync

- **WHEN** a full sync is performed for customers
- **THEN** all customers SHALL be fetched via `stripe.customers.list()`
- **AND** pagination SHALL be handled automatically

#### Scenario: Customer full sync with sync_from

- **WHEN** a full sync is performed for customers with `sync_from` configured
- **THEN** only customers created on or after `sync_from` SHALL be fetched
- **AND** deletion detection SHALL NOT remove customers created before `sync_from`

### Requirement: Stripe Product Sync

The Stripe connector SHALL sync Product resources.

#### Scenario: Product created via webhook

- **WHEN** a `product.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "stripe_product"`

#### Scenario: Product deactivated

- **WHEN** a product has `active: false`
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Product full sync

- **WHEN** a full sync is performed for products
- **THEN** all products SHALL be fetched including inactive ones

### Requirement: Stripe Price Sync

The Stripe connector SHALL sync Price resources.

#### Scenario: Price created via webhook

- **WHEN** a `price.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "stripe_price"`

#### Scenario: Price deactivated

- **WHEN** a price has `active: false`
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Price full sync

- **WHEN** a full sync is performed for prices
- **THEN** all prices SHALL be fetched including inactive ones

### Requirement: Stripe Plan Sync

The Stripe connector SHALL sync Plan resources (legacy).

#### Scenario: Plan created via webhook

- **WHEN** a `plan.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "stripe_plan"`

#### Scenario: Plan deactivated

- **WHEN** a plan has `active: false`
- **THEN** `archived_at` SHALL be set on the entity

### Requirement: Stripe Subscription Sync

The Stripe connector SHALL sync Subscription resources.

#### Scenario: Subscription created via webhook

- **WHEN** a `customer.subscription.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "stripe_subscription"`

#### Scenario: Subscription updated via webhook

- **WHEN** a `customer.subscription.updated` webhook is received
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Subscription canceled

- **WHEN** a subscription has `status: canceled`
- **THEN** `archived_at` SHALL be set on the entity
- **AND** the entity SHALL NOT be physically deleted

#### Scenario: Subscription deleted via webhook

- **WHEN** a `customer.subscription.deleted` webhook is received
- **THEN** `archived_at` SHALL be set (not physical delete)

### Requirement: Stripe Subscription Item Sync

The Stripe connector SHALL sync Subscription Item resources.

#### Scenario: Subscription item extracted

- **WHEN** a subscription is synced
- **THEN** subscription items SHALL be extracted and stored separately
- **AND** `collection_key` SHALL be "stripe_subscription_item"

#### Scenario: Subscription item updated

- **WHEN** a subscription is updated
- **THEN** associated subscription items SHALL be upserted

### Requirement: Stripe Views

The connector SHALL provide database views for common queries.

#### Scenario: Customers view available

- **WHEN** querying `supasaasy.stripe_customers`
- **THEN** the view SHALL return id, external_id, email, name, metadata, created_at

#### Scenario: Products view available

- **WHEN** querying `supasaasy.stripe_products`
- **THEN** the view SHALL return id, external_id, name, description, active, metadata

#### Scenario: Prices view available

- **WHEN** querying `supasaasy.stripe_prices`
- **THEN** the view SHALL return id, external_id, product_id, unit_amount, currency, recurring_interval

#### Scenario: Subscriptions view available

- **WHEN** querying `supasaasy.stripe_subscriptions`
- **THEN** the view SHALL return id, external_id, customer_id, status, current_period_start, current_period_end

### Requirement: Stripe SDK Usage

The connector SHALL use the official Stripe SDK.

#### Scenario: SDK handles rate limits

- **WHEN** Stripe API rate limits are hit
- **THEN** the SDK SHALL handle retries automatically

#### Scenario: API version tracked

- **WHEN** entities are synced
- **THEN** `api_version` SHALL be set to the Stripe API version used

### Requirement: Stripe Configuration

The connector SHALL be configurable via app instance settings.

#### Scenario: API key from environment

- **WHEN** the connector initializes
- **THEN** the Stripe API key SHALL be loaded from environment variables

#### Scenario: Multiple instances supported

- **WHEN** multiple Stripe instances are configured (e.g., `stripe_main`, `stripe_eu`)
- **THEN** each SHALL have its own API key and webhook secret

#### Scenario: sync_from limits historical data

- **WHEN** a Stripe app instance has `sync_from` configured
- **THEN** full sync SHALL pass `created: { gte: <timestamp> }` to all Stripe list API calls
- **AND** only records created on or after the timestamp SHALL be synced

#### Scenario: sync_from with customers

- **WHEN** syncing customers with `sync_from` configured
- **THEN** `stripe.customers.list()` SHALL include `created.gte` parameter

#### Scenario: sync_from with products

- **WHEN** syncing products with `sync_from` configured
- **THEN** `stripe.products.list()` SHALL include `created.gte` parameter

#### Scenario: sync_from with prices

- **WHEN** syncing prices with `sync_from` configured
- **THEN** `stripe.prices.list()` SHALL include `created.gte` parameter

#### Scenario: sync_from with plans

- **WHEN** syncing plans with `sync_from` configured
- **THEN** `stripe.plans.list()` SHALL include `created.gte` parameter

#### Scenario: sync_from with subscriptions

- **WHEN** syncing subscriptions with `sync_from` configured
- **THEN** `stripe.subscriptions.list()` SHALL include `created.gte` parameter
