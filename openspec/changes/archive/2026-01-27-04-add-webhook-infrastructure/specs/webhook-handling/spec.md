## ADDED Requirements

### Requirement: Webhook Endpoint

The system SHALL expose a webhook endpoint for receiving SaaS provider events.

#### Scenario: Endpoint URL pattern

- **WHEN** a SaaS provider sends a webhook
- **THEN** it SHALL be sent to `POST /webhook/{app_key}`
- **AND** the `app_key` SHALL identify the specific app instance

#### Scenario: Unknown app_key rejected

- **WHEN** a webhook is received for an unconfigured `app_key`
- **THEN** the system SHALL return 404 Not Found
- **AND** no processing SHALL occur

### Requirement: Webhook Verification

The system SHALL verify webhook authenticity before processing.

#### Scenario: Valid signature accepted

- **WHEN** a webhook with a valid signature is received
- **THEN** the system SHALL proceed to process the event

#### Scenario: Invalid signature rejected

- **WHEN** a webhook with an invalid or missing signature is received
- **THEN** the system SHALL return 401 Unauthorized
- **AND** no entity changes SHALL be made

#### Scenario: Verification before payload inspection

- **WHEN** a webhook is received
- **THEN** signature verification SHALL occur before parsing the payload
- **AND** this SHALL prevent malicious payload inspection attacks

### Requirement: Event Processing

The system SHALL process webhook events and update entities accordingly.

#### Scenario: Create event handled

- **WHEN** a webhook indicates a new entity was created
- **THEN** the system SHALL insert the entity into the database
- **AND** set appropriate timestamps

#### Scenario: Update event handled

- **WHEN** a webhook indicates an entity was updated
- **THEN** the system SHALL upsert the entity
- **AND** update the `updated_at` timestamp

#### Scenario: Delete event handled

- **WHEN** a webhook indicates an entity was deleted
- **THEN** the system SHALL physically delete the entity from the database

#### Scenario: Archive event handled

- **WHEN** a webhook indicates an entity was archived/deactivated
- **THEN** the system SHALL set `archived_at` timestamp
- **AND** the entity SHALL remain in the database

### Requirement: Idempotent Processing

The system SHALL process webhooks idempotently.

#### Scenario: Duplicate webhook safe

- **WHEN** the same webhook event is received multiple times
- **THEN** the result SHALL be identical to processing it once
- **AND** no duplicate entities SHALL be created

#### Scenario: Out-of-order webhooks handled

- **WHEN** webhooks arrive out of order
- **THEN** the `updated_at` timestamp comparison SHALL prevent stale updates
- **OR** the upsert SHALL use the unique constraint for conflict resolution

### Requirement: Response Codes

The system SHALL return appropriate HTTP response codes.

#### Scenario: Successful processing

- **WHEN** a webhook is successfully processed
- **THEN** the system SHALL return 200 OK

#### Scenario: Verification failure

- **WHEN** webhook signature verification fails
- **THEN** the system SHALL return 401 Unauthorized

#### Scenario: Configuration error

- **WHEN** the app_key is not configured
- **THEN** the system SHALL return 404 Not Found

#### Scenario: Processing error

- **WHEN** an error occurs during entity processing
- **THEN** the system SHALL return 500 Internal Server Error
- **AND** the error SHALL be logged for debugging

### Requirement: Security

The system SHALL implement security best practices for webhook handling.

#### Scenario: Secrets management

- **WHEN** webhook verification requires secrets
- **THEN** secrets SHALL be loaded from Supabase secrets management
- **AND** secrets SHALL NOT be logged or exposed in responses

#### Scenario: Per-instance secrets

- **WHEN** multiple instances of a provider are configured
- **THEN** each instance MAY have its own webhook secret
- **AND** the correct secret SHALL be used based on `app_key`
