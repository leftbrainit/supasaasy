# connector-interface Specification

## Purpose

TBD - created by archiving change 03-add-connector-interface. Update Purpose after archive.

## Requirements

### Requirement: Connector Metadata

Each connector SHALL provide metadata describing its capabilities and supported resources.

#### Scenario: Metadata includes provider name

- **WHEN** a connector is registered
- **THEN** it SHALL provide a unique provider name (e.g., "stripe", "intercom")

#### Scenario: Metadata lists supported resources

- **WHEN** a connector is registered
- **THEN** it SHALL list all supported resource types
- **AND** each resource SHALL map to a `collection_key` (e.g., "stripe_customer")

#### Scenario: Metadata includes API version

- **WHEN** a connector is registered
- **THEN** it SHALL specify the API version it targets

#### Scenario: Metadata includes migration info

- **WHEN** a connector is registered
- **THEN** it SHALL indicate whether it has migrations
- **AND** it SHALL provide the path to its migrations directory

### Requirement: Webhook Handler Interface

Each connector SHALL implement a webhook handler for real-time updates.

#### Scenario: Webhook verification

- **WHEN** a webhook request is received
- **THEN** the connector SHALL verify the request signature
- **AND** return a verification result indicating success or failure with reason

#### Scenario: Webhook event parsing

- **WHEN** a verified webhook payload is received
- **THEN** the connector SHALL parse it into a normalized event type
- **AND** identify the event type (create, update, delete, archive)

#### Scenario: Entity extraction from webhook

- **WHEN** a webhook event is parsed
- **THEN** the connector SHALL extract the entity data
- **AND** normalize it to the canonical `NormalizedEntity` format

### Requirement: Sync Handler Interface

Each connector SHALL implement sync handlers for periodic synchronization.

#### Scenario: Full sync available

- **WHEN** a backfill or reconciliation is needed
- **THEN** the connector SHALL provide a full sync function
- **AND** it SHALL fetch all entities for configured resources

#### Scenario: Incremental sync available

- **WHEN** a periodic sync runs
- **THEN** the connector SHALL provide an incremental sync function
- **AND** it SHALL fetch only entities modified since last sync

#### Scenario: Sync pagination handled

- **WHEN** syncing large datasets
- **THEN** the connector SHALL handle API pagination
- **AND** respect rate limits using official SDKs where available

#### Scenario: Sync results reported

- **WHEN** a sync operation completes
- **THEN** it SHALL return a result with counts (created, updated, deleted, errors)

### Requirement: Entity Normalization

Connectors SHALL normalize SaaS data to the canonical entity format.

#### Scenario: External ID extracted

- **WHEN** an entity is normalized
- **THEN** the `external_id` SHALL be extracted from the SaaS response

#### Scenario: Collection key assigned

- **WHEN** an entity is normalized
- **THEN** the `collection_key` SHALL identify the resource type

#### Scenario: Raw payload preserved

- **WHEN** an entity is normalized
- **THEN** the complete API response SHALL be stored in `raw_payload`

#### Scenario: Archived state detected

- **WHEN** an entity has a soft-delete state (archived, inactive, trashed)
- **THEN** the connector SHALL set `archived_at` appropriately

### Requirement: Connector Registration

The system SHALL provide a registry for connector lookup.

#### Scenario: Register connector

- **WHEN** a connector module is loaded
- **THEN** it SHALL be registered with the connector registry

#### Scenario: Lookup by provider

- **WHEN** the system needs a connector by provider name
- **THEN** `getConnector("stripe")` SHALL return the Stripe connector

#### Scenario: Lookup by app_key

- **WHEN** a webhook arrives for an `app_key`
- **THEN** the system SHALL look up the provider from configuration
- **AND** return the appropriate connector

### Requirement: Error Handling

Connectors SHALL use consistent error types for failure scenarios.

#### Scenario: Webhook verification failure

- **WHEN** webhook signature verification fails
- **THEN** a `WebhookVerificationError` SHALL be thrown

#### Scenario: API rate limit hit

- **WHEN** the SaaS API returns a rate limit error
- **THEN** a `RateLimitError` SHALL be thrown with retry-after information

#### Scenario: Entity not found

- **WHEN** an entity referenced in a webhook no longer exists
- **THEN** the connector SHALL handle it gracefully (delete or skip)

### Requirement: Connector Migration Files

Each connector SHALL include database migrations in a `migrations/` subdirectory.

#### Scenario: Migration directory structure

- **WHEN** a connector is created
- **THEN** it SHALL have a `migrations/` directory
- **AND** migrations SHALL be numbered SQL files (e.g., `001_views.sql`, `002_indexes.sql`)

#### Scenario: Migration idempotency

- **WHEN** connector migrations are applied
- **THEN** they SHALL use idempotent SQL statements
- **AND** `CREATE OR REPLACE VIEW` SHALL be used for views
- **AND** `CREATE INDEX IF NOT EXISTS` SHALL be used for indexes

#### Scenario: Migration ordering

- **WHEN** multiple migration files exist in a connector
- **THEN** they SHALL be applied in numeric order based on filename prefix

### Requirement: Connector Migration Assembly

The system SHALL assemble connector migrations based on configuration.

#### Scenario: Only configured connectors included

- **WHEN** the migration assembly script runs
- **THEN** it SHALL read `supasaasy.config.ts` to identify configured connectors
- **AND** only migrations from configured connectors SHALL be included

#### Scenario: Combined migration generated

- **WHEN** connector migrations are assembled
- **THEN** a single combined SQL file SHALL be generated
- **AND** the file SHALL be placed in `supabase/migrations/`
- **AND** the file SHALL include comments identifying the source connectors

#### Scenario: No connectors configured

- **WHEN** no connectors are configured in `supasaasy.config.ts`
- **THEN** the assembly SHALL generate an empty or no-op migration file

### Requirement: Historical Sync Filter Configuration

Connectors SHALL support an optional `sync_from` configuration to limit historical data sync.

#### Scenario: sync_from configured with ISO 8601 date

- **WHEN** an app instance has `sync_from` set to an ISO 8601 date string (e.g., "2024-01-01T00:00:00Z")
- **THEN** the connector SHALL parse the date and use it as the minimum creation timestamp for full sync

#### Scenario: sync_from limits full sync scope

- **WHEN** a full sync is performed with `sync_from` configured
- **THEN** only records created on or after `sync_from` SHALL be fetched
- **AND** records created before `sync_from` SHALL NOT be fetched

#### Scenario: sync_from does not affect incremental sync

- **WHEN** an incremental sync is performed
- **THEN** the `sync_from` configuration SHALL NOT override the incremental sync timestamp
- **AND** incremental sync SHALL use the last sync timestamp as usual

#### Scenario: Deletion detection respects sync_from

- **WHEN** full sync runs with `sync_from` configured
- **THEN** deletion detection SHALL only remove records that were expected in the sync window
- **AND** records created before `sync_from` SHALL NOT be deleted due to being absent from the sync

#### Scenario: sync_from not configured

- **WHEN** an app instance does not have `sync_from` set
- **THEN** full sync SHALL fetch all historical records as before
