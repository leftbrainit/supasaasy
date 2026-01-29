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

#### Scenario: CORS restricted

- **WHEN** the webhook endpoint responds to requests
- **THEN** CORS headers SHALL NOT use wildcard origins
- **AND** CORS SHALL only be enabled for preflight OPTIONS requests
- **AND** non-browser clients (SaaS webhooks) SHALL not require CORS
