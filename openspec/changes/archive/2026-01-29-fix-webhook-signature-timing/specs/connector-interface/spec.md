## MODIFIED Requirements

### Requirement: Webhook Handler Interface

Each connector SHALL implement a webhook handler for real-time updates.

#### Scenario: Webhook verification

- **WHEN** a webhook request is received
- **THEN** the connector SHALL verify the request signature
- **AND** return a verification result indicating success or failure with reason

#### Scenario: Webhook verification uses constant-time comparison

- **WHEN** comparing webhook signatures
- **THEN** the connector SHALL use constant-time string comparison
- **AND** the comparison SHALL NOT be vulnerable to timing attacks
- **AND** the comparison function SHALL return consistent timing regardless of where strings differ

#### Scenario: Webhook event parsing

- **WHEN** a verified webhook payload is received
- **THEN** the connector SHALL parse it into a normalized event type
- **AND** identify the event type (create, update, delete, archive)

#### Scenario: Entity extraction from webhook

- **WHEN** a webhook event is parsed
- **THEN** the connector SHALL extract the entity data
- **AND** normalize it to the canonical `NormalizedEntity` format

## MODIFIED Requirements

### Requirement: Error Handling

Connectors SHALL use consistent error types for failure scenarios.

#### Scenario: Webhook verification failure

- **WHEN** webhook signature verification fails
- **THEN** a `WebhookVerificationError` SHALL be thrown

#### Scenario: Webhook verification failure logging

- **WHEN** webhook signature verification fails
- **THEN** the connector SHALL NOT log signature values (including partial/truncated)
- **AND** the connector SHALL only log that verification failed with a generic reason

#### Scenario: API rate limit hit

- **WHEN** the SaaS API returns a rate limit error
- **THEN** a `RateLimitError` SHALL be thrown with retry-after information

#### Scenario: Entity not found

- **WHEN** an entity referenced in a webhook no longer exists
- **THEN** the connector SHALL handle it gracefully (delete or skip)
