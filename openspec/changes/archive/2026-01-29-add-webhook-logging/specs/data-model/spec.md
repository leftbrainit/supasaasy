## ADDED Requirements

### Requirement: Webhook Logs Table

The system SHALL provide a `supasaasy.webhook_logs` table to store webhook request history.

#### Scenario: Table structure complete

- **WHEN** the database is migrated
- **THEN** the `supasaasy.webhook_logs` table SHALL exist
- **AND** the table SHALL contain columns: `id`, `app_key`, `request_method`, `request_path`, `request_headers`, `request_body`, `response_status`, `response_body`, `error_message`, `processing_duration_ms`, `created_at`

#### Scenario: Primary key is UUID

- **WHEN** a webhook log entry is inserted
- **THEN** the `id` column SHALL be a UUID primary key
- **AND** it SHALL be auto-generated

#### Scenario: Timestamp auto-set

- **WHEN** a webhook log entry is inserted
- **THEN** `created_at` SHALL default to the current timestamp

#### Scenario: Request headers stored as JSONB

- **WHEN** a webhook log entry is created
- **THEN** request headers SHALL be stored in a JSONB column
- **AND** sensitive headers SHALL be redacted before storage

#### Scenario: Request body stored as JSONB

- **WHEN** a webhook log entry is created
- **THEN** request body SHALL be stored in a JSONB column
- **AND** the body SHALL be stored as-is without modification

#### Scenario: Response body stored as JSONB

- **WHEN** a webhook log entry is created
- **THEN** response body SHALL be stored in a JSONB column

#### Scenario: Query performance indexes

- **WHEN** querying webhook logs
- **THEN** indexes SHALL optimize queries by app_key, response_status, and created_at
- **AND** lookup by timestamp SHALL be efficient for time-range queries

### Requirement: Webhook Log Insertion Helper

The system SHALL provide a database helper function to insert webhook log entries.

#### Scenario: Log insertion helper available

- **WHEN** the webhook handler needs to log a request
- **THEN** a shared insert function SHALL be available
- **AND** it SHALL accept webhook log data
- **AND** it SHALL handle database errors gracefully without failing the webhook response
