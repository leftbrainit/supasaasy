# webhook-handling Specification

## Purpose

TBD - created by archiving change 04-add-webhook-infrastructure. Update Purpose after archive.

## Requirements

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

#### Scenario: App key format validated

- **WHEN** a webhook is received with an app_key in the URL
- **THEN** the app_key SHALL be validated for format
- **AND** only alphanumeric characters, underscores, and hyphens SHALL be allowed
- **AND** invalid app_key formats SHALL return 400 Bad Request

#### Scenario: Request body size limited

- **WHEN** a webhook request is received
- **THEN** the request body size SHALL be validated
- **AND** requests exceeding 1MB SHALL be rejected with 413 Payload Too Large

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

#### Scenario: Error messages sanitized

- **WHEN** returning error responses to clients
- **THEN** internal error details SHALL NOT be exposed
- **AND** generic error messages SHALL be used for 500 errors
- **AND** detailed errors SHALL only be logged server-side

#### Scenario: CORS restricted

- **WHEN** the webhook endpoint responds to requests
- **THEN** CORS headers SHALL NOT use wildcard origins
- **AND** CORS SHALL only be enabled for preflight OPTIONS requests
- **AND** non-browser clients (SaaS webhooks) SHALL not require CORS

### Requirement: Rate Limiting

The system SHALL implement rate limiting to protect against abuse.

#### Scenario: Webhook rate limit enforced

- **WHEN** webhook requests exceed the configured rate limit
- **THEN** the system SHALL return 429 Too Many Requests
- **AND** the response SHALL include a Retry-After header

#### Scenario: Webhook rate limit configurable

- **WHEN** the webhook handler is initialized
- **THEN** the rate limit SHALL be configurable
- **AND** the default SHALL be 100 requests per minute

#### Scenario: Rate limit by IP or app_key

- **WHEN** rate limiting is applied
- **THEN** limits SHALL be tracked per source IP or per app_key
- **AND** legitimate requests from different sources SHALL not be affected by others

### Requirement: Webhook Logging

The system SHALL log webhook requests when logging is enabled in configuration.

#### Scenario: Successful webhook logged

- **WHEN** a webhook is successfully processed
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with request details, response status 200, and processing metadata
- **AND** the log SHALL include timestamp, app_key, event type, and resource information

#### Scenario: Failed authorization logged

- **WHEN** webhook signature verification fails
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with request details and response status 401
- **AND** the log SHALL capture the verification failure reason
- **AND** sensitive data SHALL NOT be logged

#### Scenario: Unknown app_key logged

- **WHEN** a webhook is received for an unconfigured app_key
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with response status 404
- **AND** the log SHALL include the attempted app_key

#### Scenario: Processing error logged

- **WHEN** an error occurs during webhook processing
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with response status 500
- **AND** the log SHALL include error information without exposing sensitive internal details

#### Scenario: Rate limit rejection logged

- **WHEN** a webhook is rejected due to rate limiting
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with response status 429
- **AND** the log SHALL include the rate limit key

#### Scenario: Logging disabled skips storage

- **WHEN** a webhook is processed
- **AND** webhook logging is disabled in configuration
- **THEN** no database log entry SHALL be created
- **AND** console logging SHALL still occur for debugging

#### Scenario: Request body size validation failure logged

- **WHEN** a webhook request exceeds the maximum body size
- **AND** webhook logging is enabled
- **THEN** a log entry SHALL be created with response status 413

### Requirement: Webhook Log Configuration

The system SHALL allow configuration of webhook logging behavior.

#### Scenario: Logging enabled via config

- **WHEN** the configuration includes `webhook_logging: { enabled: true }`
- **THEN** all webhook requests SHALL be logged to the database

#### Scenario: Logging disabled via config

- **WHEN** the configuration includes `webhook_logging: { enabled: false }`
- **THEN** webhook requests SHALL NOT be logged to the database

#### Scenario: Logging defaults to disabled

- **WHEN** no webhook logging configuration is provided
- **THEN** webhook logging SHALL be disabled by default
- **AND** only console logs SHALL be generated
