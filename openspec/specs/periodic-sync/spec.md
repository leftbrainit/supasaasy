# periodic-sync Specification

## Purpose

TBD - created by archiving change 05-add-periodic-sync. Update Purpose after archive.

## Requirements

### Requirement: Sync Endpoint

The system SHALL provide an endpoint for triggering synchronization.

#### Scenario: Manual sync trigger

- **WHEN** an authenticated request is made to the sync endpoint
- **THEN** a sync operation SHALL be initiated for the specified app instance

#### Scenario: Admin authentication required

- **WHEN** a sync request lacks valid admin API key
- **THEN** the system SHALL return 401 Unauthorized
- **AND** no sync SHALL be performed

#### Scenario: Admin key uses constant-time comparison

- **WHEN** verifying the admin API key
- **THEN** the system SHALL use constant-time string comparison
- **AND** the comparison SHALL NOT be vulnerable to timing attacks

#### Scenario: App key specified

- **WHEN** a sync request is made
- **THEN** the request SHALL specify which `app_key` to sync

#### Scenario: App key format validated

- **WHEN** a sync request is made with an app_key
- **THEN** the app_key SHALL be validated for format
- **AND** only alphanumeric characters, underscores, and hyphens SHALL be allowed
- **AND** invalid app_key formats SHALL return 400 Bad Request

#### Scenario: Request body size limited

- **WHEN** a sync request is received
- **THEN** the request body size SHALL be validated
- **AND** requests exceeding 1MB SHALL be rejected with 413 Payload Too Large

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
- **THEN** the error SHALL be logged server-side
- **AND** the sync MAY continue with other entities

#### Scenario: Rate limits respected

- **WHEN** the SaaS API returns a rate limit error
- **THEN** the connector SHALL handle it appropriately
- **AND** the sync SHALL fail with a clear error message

#### Scenario: Safe retry

- **WHEN** a sync fails
- **THEN** re-running the sync SHALL be safe due to idempotency

#### Scenario: Error responses sanitized

- **WHEN** returning error responses to clients
- **THEN** internal error details SHALL NOT be exposed in the response body
- **AND** generic error messages SHALL be used for 500 errors (e.g., "Internal server error")
- **AND** detailed errors SHALL only be logged server-side for debugging

### Requirement: Sync Rate Limiting

The system SHALL implement rate limiting on the sync endpoint to protect against abuse.

#### Scenario: Sync rate limit enforced

- **WHEN** sync requests exceed the configured rate limit
- **THEN** the system SHALL return 429 Too Many Requests
- **AND** the response SHALL include a Retry-After header

#### Scenario: Sync rate limit configurable

- **WHEN** the sync handler is initialized
- **THEN** the rate limit SHALL be configurable
- **AND** the default SHALL be 10 requests per minute

#### Scenario: Rate limit by API key

- **WHEN** rate limiting is applied to sync
- **THEN** limits SHALL be tracked per authenticated API key
- **AND** different API keys SHALL have independent rate limits

### Requirement: CORS Configuration

The sync endpoint SHALL have restrictive CORS settings appropriate for server-to-server communication.

#### Scenario: CORS restricted

- **WHEN** the sync endpoint responds to requests
- **THEN** CORS headers SHALL NOT use wildcard origins
- **AND** CORS SHALL only be enabled for preflight OPTIONS requests
- **AND** API clients SHALL authenticate with Bearer tokens instead of relying on CORS
