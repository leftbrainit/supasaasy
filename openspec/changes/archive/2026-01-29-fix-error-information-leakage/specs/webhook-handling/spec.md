## MODIFIED Requirements

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
- **AND** the response SHALL contain a generic error message (e.g., "Internal server error")
- **AND** the response SHALL NOT contain detailed error messages, stack traces, or internal information
- **AND** the detailed error SHALL be logged server-side for debugging

## MODIFIED Requirements

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
