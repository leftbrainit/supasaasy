## ADDED Requirements

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
