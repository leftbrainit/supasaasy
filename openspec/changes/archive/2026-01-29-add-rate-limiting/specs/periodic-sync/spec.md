## ADDED Requirements

### Requirement: Sync Rate Limiting

The system SHALL implement rate limiting on the sync endpoint to protect against abuse.

#### Scenario: Sync rate limit enforced

- **WHEN** sync requests exceed the configured rate limit
- **THEN** the system SHALL return 429 Too Many Requests
- **AND** the response SHALL include a Retry-After header

#### Scenario: Sync rate limit configurable

- **WHEN** the sync handler is initialized
- **THEN** the rate limit SHALL be configurable
- **AND** the default SHALL be 10 requests per minute

#### Scenario: Rate limit by API key

- **WHEN** rate limiting is applied to sync
- **THEN** limits SHALL be tracked per authenticated API key
- **AND** different API keys SHALL have independent rate limits
