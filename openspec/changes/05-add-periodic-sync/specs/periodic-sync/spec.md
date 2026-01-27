## ADDED Requirements

### Requirement: Sync Endpoint
The system SHALL provide an endpoint for triggering synchronization.

#### Scenario: Manual sync trigger
- **WHEN** an authenticated request is made to the sync endpoint
- **THEN** a sync operation SHALL be initiated for the specified app instance

#### Scenario: Admin authentication required
- **WHEN** a sync request lacks valid admin API key
- **THEN** the system SHALL return 401 Unauthorized
- **AND** no sync SHALL be performed

#### Scenario: App key specified
- **WHEN** a sync request is made
- **THEN** the request SHALL specify which `app_key` to sync

### Requirement: Full Sync Mode
The system SHALL support full synchronization for backfills and reconciliation.

#### Scenario: Full sync fetches all entities
- **WHEN** a full sync is requested
- **THEN** the connector SHALL fetch all entities for configured resources
- **AND** entities SHALL be upserted to the database

#### Scenario: Full sync handles pagination
- **WHEN** the SaaS API has paginated results
- **THEN** the sync SHALL iterate through all pages
- **AND** respect API rate limits

#### Scenario: Full sync detects deletions
- **WHEN** an entity exists in the database but not in the API response
- **THEN** the entity SHALL be physically deleted
- **AND** the deletion SHALL be logged

### Requirement: Incremental Sync Mode
The system SHALL support incremental synchronization for efficiency.

#### Scenario: Incremental sync uses timestamp
- **WHEN** an incremental sync is requested
- **THEN** the connector SHALL fetch only entities modified since last sync
- **AND** the last sync timestamp SHALL be stored per (app_key, collection_key)

#### Scenario: Incremental sync updates state
- **WHEN** an incremental sync completes successfully
- **THEN** the sync state timestamp SHALL be updated

#### Scenario: Fallback to full sync
- **WHEN** no previous sync state exists
- **THEN** the system SHALL perform a full sync instead

### Requirement: Scheduled Sync
The system SHALL support automated periodic synchronization.

#### Scenario: Cron schedule configured
- **WHEN** an app instance has a schedule in configuration
- **THEN** pg_cron SHALL trigger the sync function on that schedule

#### Scenario: Schedule per app instance
- **WHEN** multiple app instances are configured
- **THEN** each MAY have its own sync schedule
- **AND** schedules SHALL be independent

#### Scenario: Scheduled sync is incremental
- **WHEN** a scheduled sync runs
- **THEN** it SHALL use incremental mode by default

### Requirement: Sync State Tracking
The system SHALL track synchronization state for incremental syncs.

#### Scenario: State table exists
- **WHEN** the database is migrated
- **THEN** a `supasaasy.sync_state` table SHALL exist

#### Scenario: State tracked per collection
- **WHEN** sync state is recorded
- **THEN** it SHALL be keyed by `(app_key, collection_key)`
- **AND** store `last_synced_at` timestamp

#### Scenario: State survives failures
- **WHEN** a sync fails partway through
- **THEN** the previous sync state SHALL be preserved
- **AND** the next sync SHALL retry from that point

### Requirement: Sync Results
The system SHALL report synchronization results.

#### Scenario: Success counts returned
- **WHEN** a sync completes
- **THEN** the response SHALL include counts of created, updated, deleted entities

#### Scenario: Error counts returned
- **WHEN** a sync encounters errors
- **THEN** the response SHALL include error count and details
- **AND** partial success SHALL still be reported

#### Scenario: Idempotent re-runs
- **WHEN** a sync is run multiple times
- **THEN** the final database state SHALL be consistent
- **AND** re-running a sync SHALL be safe

### Requirement: Failure Handling
The system SHALL handle sync failures gracefully.

#### Scenario: API errors logged
- **WHEN** the SaaS API returns an error
- **THEN** the error SHALL be logged
- **AND** the sync MAY continue with other entities

#### Scenario: Rate limits respected
- **WHEN** the SaaS API returns a rate limit error
- **THEN** the connector SHALL handle it appropriately
- **AND** the sync SHALL fail with a clear error message

#### Scenario: Safe retry
- **WHEN** a sync fails
- **THEN** re-running the sync SHALL be safe due to idempotency
