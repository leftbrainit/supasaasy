# connector-interface Specification Delta

## ADDED Requirements

### Requirement: Environment-Based Debug Mode

The system SHALL support enabling debug logging via the `SUPASAASY_DEBUG` environment variable.

#### Scenario: Debug mode enabled via environment variable

- **WHEN** the `SUPASAASY_DEBUG` environment variable is set to `"true"`
- **THEN** detailed debug logging SHALL be enabled throughout the library
- **AND** all handlers and connectors SHALL emit debug-level logs

#### Scenario: Debug mode disabled by default

- **WHEN** the `SUPASAASY_DEBUG` environment variable is not set or set to any value other than `"true"`
- **THEN** debug logging SHALL be disabled
- **AND** only standard operational logs SHALL be emitted

#### Scenario: Debug utility function available

- **WHEN** a project imports the library
- **THEN** an `isDebugEnabled()` function SHALL be available
- **AND** a `debugLog()` helper function SHALL be available for custom debug logging

### Requirement: Debug Logging in Handlers

Handlers SHALL emit debug logs when debug mode is enabled.

#### Scenario: Worker handler debug logging

- **WHEN** debug mode is enabled and the worker processes a task
- **THEN** it SHALL log task claim attempts with job ID
- **AND** it SHALL log connector and resource type selection
- **AND** it SHALL log sync options being used
- **AND** it SHALL log task completion with entity counts

#### Scenario: Sync handler debug logging

- **WHEN** debug mode is enabled and a sync is initiated
- **THEN** it SHALL log job creation with app key and mode
- **AND** it SHALL log resource type selection logic
- **AND** it SHALL log immediate vs job-based sync decision

#### Scenario: Webhook handler debug logging

- **WHEN** debug mode is enabled and a webhook is received
- **THEN** it SHALL log incoming request details (method, path, redacted headers)
- **AND** it SHALL log verification result (valid/invalid, no secret values)
- **AND** it SHALL log parsed event type and resource type
- **AND** it SHALL log database operation results

### Requirement: Debug Logging in Database Operations

Database operations SHALL emit debug logs when debug mode is enabled.

#### Scenario: Entity upsert debug logging

- **WHEN** debug mode is enabled and entities are upserted
- **THEN** it SHALL log the number of entities being upserted
- **AND** it SHALL log the collection keys involved
- **AND** it SHALL log success or failure result

#### Scenario: Entity delete debug logging

- **WHEN** debug mode is enabled and entities are deleted
- **THEN** it SHALL log the external IDs being deleted
- **AND** it SHALL log the collection key
- **AND** it SHALL log success or failure result

#### Scenario: Sync state debug logging

- **WHEN** debug mode is enabled and sync state is updated
- **THEN** it SHALL log the app key and collection key
- **AND** it SHALL log the new last_synced_at timestamp

### Requirement: Debug Logging in Sync Operations

Sync operations SHALL emit debug logs when debug mode is enabled.

#### Scenario: Pagination debug logging

- **WHEN** debug mode is enabled and paginated sync runs
- **THEN** it SHALL log each page fetch with page number and cursor
- **AND** it SHALL log the number of items received per page
- **AND** it SHALL log cumulative progress

#### Scenario: Entity processing debug logging

- **WHEN** debug mode is enabled and entities are normalized
- **THEN** it SHALL log each entity's external ID being processed
- **AND** it SHALL log the collection key assignment
- **AND** it SHALL NOT log the full raw payload (to avoid excessive output)

#### Scenario: Deletion detection debug logging

- **WHEN** debug mode is enabled and deletion detection runs
- **THEN** it SHALL log the number of existing IDs being checked
- **AND** it SHALL log each ID identified for deletion
- **AND** it SHALL log the total deletion count

### Requirement: Debug Log Security

Debug logging SHALL not expose sensitive information.

#### Scenario: API keys never in debug logs

- **WHEN** debug mode is enabled
- **THEN** API keys SHALL NOT appear in any log output
- **AND** environment variable names for keys MAY be logged

#### Scenario: Webhook secrets never in debug logs

- **WHEN** debug mode is enabled and webhooks are processed
- **THEN** webhook secrets SHALL NOT appear in any log output
- **AND** signature values SHALL NOT appear in any log output

#### Scenario: Request bodies redacted appropriately

- **WHEN** debug mode is enabled and request bodies are logged
- **THEN** sensitive fields (passwords, tokens, secrets) SHALL be redacted
- **AND** the redaction SHALL replace values with "[REDACTED]"

## MODIFIED Requirements

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

#### Scenario: Debug mode enables verbose logging

- **WHEN** debug mode is enabled via `SUPASAASY_DEBUG=true`
- **THEN** verbose logging SHALL be automatically enabled for all sync operations
- **AND** explicit `verbose: false` in SyncOptions SHALL override this behavior
