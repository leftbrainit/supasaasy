## MODIFIED Requirements

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
