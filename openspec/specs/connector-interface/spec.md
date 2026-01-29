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
- **AND** `getConnector("intercom")` SHALL return the Intercom connector

#### Scenario: Lookup by app_key

- **WHEN** a webhook arrives for an `app_key`
- **THEN** the system SHALL look up the provider from configuration
- **AND** return the appropriate connector

### Requirement: Error Handling

Connectors SHALL use consistent error types for failure scenarios.

#### Scenario: Webhook verification failure

- **WHEN** webhook signature verification fails
- **THEN** a `WebhookVerificationError` SHALL be thrown

#### Scenario: Webhook verification failure logging

- **WHEN** webhook signature verification fails
- **THEN** the connector SHALL NOT log signature values (including partial/truncated)
- **AND** the connector SHALL only log that verification failed with a generic reason

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

### Requirement: Connector Module Organization

Connectors SHALL organize code into logical modules to improve maintainability and testability.

#### Scenario: Connector has client module

- **WHEN** a connector needs to create API clients
- **THEN** client creation logic SHALL be in a dedicated `client.ts` module
- **AND** the module SHALL export functions for client instantiation and configuration

#### Scenario: Connector has normalization module

- **WHEN** a connector normalizes API responses to entities
- **THEN** normalization logic SHALL be in a dedicated `normalization.ts` module
- **AND** the module SHALL export the `normalizeEntity` function and related helpers

#### Scenario: Connector has webhooks module

- **WHEN** a connector handles webhooks
- **THEN** webhook logic SHALL be in a dedicated `webhooks.ts` module
- **AND** the module SHALL export `verifyWebhook`, `parseWebhookEvent`, and `extractEntity` functions

#### Scenario: Connector has sync module

- **WHEN** a connector performs data synchronization
- **THEN** sync logic SHALL be organized in a `sync/` directory
- **AND** orchestration logic SHALL be in `sync/index.ts`
- **AND** resource-specific sync functions MAY be in separate files

#### Scenario: Connector index re-exports

- **WHEN** the main `index.ts` is imported
- **THEN** it SHALL re-export the connector object and metadata
- **AND** it SHALL handle connector registration with the registry

### Requirement: Paginated Sync Utility

The system SHALL provide a generic utility for paginated API synchronization.

#### Scenario: Utility handles pagination loop

- **WHEN** `paginatedSync()` is called with a list function
- **THEN** it SHALL iterate through all pages using cursor-based pagination
- **AND** it SHALL call the normalize function for each item
- **AND** it SHALL batch upsert entities to the database

#### Scenario: Utility tracks timing and results

- **WHEN** a paginated sync completes
- **THEN** it SHALL return a `SyncResult` with created, updated, deleted, errors counts
- **AND** it SHALL include `durationMs` for the total operation time

#### Scenario: Utility handles sync_from filter

- **WHEN** `paginatedSync()` is called with a `syncFromTimestamp`
- **THEN** it SHALL pass the timestamp to the list function
- **AND** only records created after the timestamp SHALL be fetched

#### Scenario: Utility detects deletions during full sync

- **WHEN** a full sync is performed with `existingIds` provided
- **THEN** the utility SHALL detect IDs present in `existingIds` but not in the API response
- **AND** those entities SHALL be deleted from the database

#### Scenario: Utility respects pagination limits

- **WHEN** `options.limit` is specified
- **THEN** the utility SHALL stop fetching after the limit is reached
- **AND** it SHALL not fetch unnecessary pages

#### Scenario: Utility handles errors gracefully

- **WHEN** an error occurs during sync
- **THEN** the utility SHALL catch the error
- **AND** it SHALL return a failed `SyncResult` with error messages
- **AND** partial progress SHALL be preserved

### Requirement: Dry-Run Sync Mode

Connectors SHALL support a dry-run mode for testing sync operations without database writes.

#### Scenario: Dry-run skips database writes

- **WHEN** a sync is performed with `dryRun: true`
- **THEN** the connector SHALL fetch data from the API
- **AND** the connector SHALL normalize entities
- **AND** the connector SHALL NOT write to the database

#### Scenario: Dry-run logs intended operations

- **WHEN** a sync is performed with `dryRun: true`
- **THEN** the connector SHALL log what would be created, updated, or deleted
- **AND** the log SHALL include entity external IDs and collection keys

#### Scenario: Dry-run returns accurate counts

- **WHEN** a dry-run sync completes
- **THEN** the `SyncResult` SHALL reflect what would have been created/updated/deleted
- **AND** the counts SHALL match a real sync operation

### Requirement: Sync Progress Reporting

Connectors SHALL support progress callbacks for monitoring long-running syncs.

#### Scenario: Progress callback invoked per batch

- **WHEN** a sync is performed with `onProgress` callback
- **THEN** the callback SHALL be invoked after each batch is processed
- **AND** the callback SHALL receive progress information

#### Scenario: Progress includes resource and counts

- **WHEN** the `onProgress` callback is invoked
- **THEN** it SHALL receive the resource type being synced
- **AND** it SHALL receive the number of items fetched so far
- **AND** it MAY receive the total count if known

### Requirement: Verbose Logging Mode

Connectors SHALL support verbose logging for detailed debugging.

#### Scenario: Verbose mode logs each entity

- **WHEN** a sync is performed with `verbose: true`
- **THEN** the connector SHALL log each entity being processed
- **AND** the log SHALL include the external ID and key fields

#### Scenario: Verbose mode disabled by default

- **WHEN** a sync is performed without `verbose` option
- **THEN** per-entity logging SHALL NOT occur
- **AND** only summary logs SHALL be emitted

### Requirement: Connector Configuration Validation

Connectors SHALL validate their configuration before operations.

#### Scenario: Validation method available

- **WHEN** a connector is registered
- **THEN** it MAY provide a `validateConfig(appConfig)` method
- **AND** the method SHALL return validation results with any errors

#### Scenario: Validation called on initialization

- **WHEN** `getConnectorForAppKey` is called
- **THEN** the connector's `validateConfig` method SHALL be called if present
- **AND** a `ConfigurationError` SHALL be thrown if validation fails

#### Scenario: API key validation

- **WHEN** validating a connector that requires an API key
- **THEN** the validator SHALL check that the configured environment variable exists
- **OR** a direct API key is provided
- **AND** an error SHALL be returned if neither is available

#### Scenario: Direct secret usage warning

- **WHEN** validating a connector with direct `api_key` or `webhook_secret` values
- **THEN** the validator SHALL log a warning about security implications
- **AND** the warning SHALL recommend using environment variables instead
- **AND** in production environment, direct secrets SHALL be rejected with an error

#### Scenario: Webhook secret validation

- **WHEN** validating a connector for an app that receives webhooks
- **THEN** the validator SHALL check that a webhook secret is configured
- **AND** an error SHALL be returned if the secret is missing

#### Scenario: Resource type validation

- **WHEN** validating `sync_resources` configuration
- **THEN** the validator SHALL check each resource type is supported
- **AND** an error SHALL be returned for unknown resource types

#### Scenario: Date format validation

- **WHEN** validating `sync_from` configuration
- **THEN** the validator SHALL check the value is a valid ISO 8601 date string
- **AND** an error SHALL be returned if the format is invalid

#### Scenario: Validation errors are actionable

- **WHEN** a validation error occurs
- **THEN** the error message SHALL identify the specific field
- **AND** the message SHALL describe what is wrong
- **AND** the message SHALL suggest how to fix it

### Requirement: Secret Handling Security

Connectors SHALL handle secrets securely and never expose them in logs or errors.

#### Scenario: Secrets never logged

- **WHEN** processing API keys or webhook secrets
- **THEN** the connector SHALL NOT log secret values
- **AND** the connector SHALL NOT include secrets in error messages
- **AND** debug logging SHALL sanitize any fields that might contain secrets

#### Scenario: Environment variable precedence

- **WHEN** both `api_key_env` and `api_key` are configured
- **THEN** the environment variable SHALL take precedence
- **AND** the direct secret SHALL be ignored

#### Scenario: Production environment protection

- **WHEN** running in a production environment (Deno Deploy or explicit production flag)
- **THEN** direct `api_key` and `webhook_secret` values SHALL be rejected
- **AND** an error SHALL be thrown requiring environment variables

