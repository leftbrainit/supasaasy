## MODIFIED Requirements

### Requirement: Sync Endpoint

The system SHALL provide an endpoint for triggering synchronization.

#### Scenario: Manual sync trigger

- **WHEN** an authenticated request is made to the sync endpoint
- **THEN** a sync operation SHALL be initiated for the specified app instance

#### Scenario: Admin authentication required

- **WHEN** a sync request lacks valid admin API key
- **THEN** the system SHALL return 401 Unauthorized
- **AND** no sync SHALL be performed

#### Scenario: Admin key uses constant-time comparison

- **WHEN** verifying the admin API key
- **THEN** the system SHALL use constant-time string comparison
- **AND** the comparison SHALL NOT be vulnerable to timing attacks

#### Scenario: App key specified

- **WHEN** a sync request is made
- **THEN** the request SHALL specify which `app_key` to sync

#### Scenario: App key format validated

- **WHEN** a sync request is made with an app_key
- **THEN** the app_key SHALL be validated for format
- **AND** only alphanumeric characters, underscores, and hyphens SHALL be allowed
- **AND** invalid app_key formats SHALL return 400 Bad Request

#### Scenario: Request body size limited

- **WHEN** a sync request is received
- **THEN** the request body size SHALL be validated
- **AND** requests exceeding 1MB SHALL be rejected with 413 Payload Too Large
