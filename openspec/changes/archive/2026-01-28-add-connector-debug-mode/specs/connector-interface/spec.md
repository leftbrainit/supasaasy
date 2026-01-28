## ADDED Requirements

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
