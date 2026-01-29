## MODIFIED Requirements

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
