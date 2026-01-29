## ADDED Requirements

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
