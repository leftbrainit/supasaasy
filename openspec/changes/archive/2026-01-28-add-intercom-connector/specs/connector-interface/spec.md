## MODIFIED Requirements

### Requirement: Connector Registration

The system SHALL provide a registry for connector lookup.

#### Scenario: Register connector

- **WHEN** a connector module is loaded
- **THEN** it SHALL be registered with the connector registry

#### Scenario: Lookup by provider

- **WHEN** the system needs a connector by provider name
- **THEN** `getConnector("stripe")` SHALL return the Stripe connector
- **AND** `getConnector("intercom")` SHALL return the Intercom connector

#### Scenario: Lookup by app_key

- **WHEN** a webhook arrives for an `app_key`
- **THEN** the system SHALL look up the provider from configuration
- **AND** return the appropriate connector
