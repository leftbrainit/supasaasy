## ADDED Requirements

### Requirement: Connector Configuration Validation

Connectors SHALL validate their configuration before operations.

#### Scenario: Validation method available

- **WHEN** a connector is registered
- **THEN** it MAY provide a `validateConfig(appConfig)` method
- **AND** the method SHALL return validation results with any errors

#### Scenario: Validation called on initialization

- **WHEN** `getConnectorForAppKey` is called
- **THEN** the connector's `validateConfig` method SHALL be called if present
- **AND** a `ConfigurationError` SHALL be thrown if validation fails

#### Scenario: API key validation

- **WHEN** validating a connector that requires an API key
- **THEN** the validator SHALL check that the configured environment variable exists
- **OR** a direct API key is provided
- **AND** an error SHALL be returned if neither is available

#### Scenario: Webhook secret validation

- **WHEN** validating a connector for an app that receives webhooks
- **THEN** the validator SHALL check that a webhook secret is configured
- **AND** an error SHALL be returned if the secret is missing

#### Scenario: Resource type validation

- **WHEN** validating `sync_resources` configuration
- **THEN** the validator SHALL check each resource type is supported
- **AND** an error SHALL be returned for unknown resource types

#### Scenario: Date format validation

- **WHEN** validating `sync_from` configuration
- **THEN** the validator SHALL check the value is a valid ISO 8601 date string
- **AND** an error SHALL be returned if the format is invalid

#### Scenario: Validation errors are actionable

- **WHEN** a validation error occurs
- **THEN** the error message SHALL identify the specific field
- **AND** the message SHALL describe what is wrong
- **AND** the message SHALL suggest how to fix it
