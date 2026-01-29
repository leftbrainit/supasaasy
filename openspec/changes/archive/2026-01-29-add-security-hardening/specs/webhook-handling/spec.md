## MODIFIED Requirements

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
