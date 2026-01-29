## ADDED Requirements

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
