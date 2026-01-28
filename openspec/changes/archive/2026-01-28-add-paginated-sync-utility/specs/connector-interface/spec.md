## ADDED Requirements

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
