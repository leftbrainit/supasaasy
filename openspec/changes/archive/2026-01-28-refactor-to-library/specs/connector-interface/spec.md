## MODIFIED Requirements

### Requirement: Connector Registration

The library SHALL provide a registry for connector lookup that is auto-populated from exports.

#### Scenario: Register connector

- **WHEN** the library is imported
- **THEN** all official connectors SHALL be automatically registered with the connector registry
- **AND** registration SHALL happen via the main module initialization

#### Scenario: Lookup by provider

- **WHEN** the system needs a connector by provider name
- **THEN** `getConnector("stripe")` SHALL return the Stripe connector
- **AND** `getConnector("intercom")` SHALL return the Intercom connector

#### Scenario: Lookup by app_key

- **WHEN** a webhook arrives for an `app_key`
- **THEN** the system SHALL look up the provider from the passed configuration
- **AND** return the appropriate connector

#### Scenario: Config passed to connector lookup

- **WHEN** `getConnectorForAppKey(appKey, config)` is called
- **THEN** the config parameter SHALL be used to find the app configuration
- **AND** the connector SHALL NOT rely on global config imports

### Requirement: Connector Migration Files

Each connector SHALL include database migrations accessible via the library.

#### Scenario: Migration directory structure

- **WHEN** a connector is created in `packages/supasaasy/src/connectors/`
- **THEN** it SHALL have a `migrations/` directory
- **AND** migrations SHALL be numbered SQL files (e.g., `001_views.sql`, `002_indexes.sql`)

#### Scenario: Migrations exported via metadata

- **WHEN** a connector is registered
- **THEN** its metadata SHALL include migration file paths or content
- **AND** the `getMigrations()` function SHALL aggregate migrations from configured connectors

#### Scenario: Migration idempotency

- **WHEN** connector migrations are included in generated output
- **THEN** they SHALL use idempotent SQL statements
- **AND** `CREATE OR REPLACE VIEW` SHALL be used for views
- **AND** `CREATE INDEX IF NOT EXISTS` SHALL be used for indexes

### Requirement: Connector Module Organization

Connectors SHALL be organized within the library package structure.

#### Scenario: Connector location in package

- **WHEN** a connector is part of the library
- **THEN** it SHALL be located at `packages/supasaasy/src/connectors/<name>/`
- **AND** the structure SHALL match existing conventions (client.ts, webhooks.ts, sync/, etc.)

#### Scenario: Connector has client module

- **WHEN** a connector needs to create API clients
- **THEN** client creation logic SHALL be in a dedicated `client.ts` module
- **AND** the module SHALL export functions for client instantiation and configuration

#### Scenario: Connector has normalization module

- **WHEN** a connector normalizes API responses to entities
- **THEN** normalization logic SHALL be in a dedicated `normalization.ts` module
- **AND** the module SHALL export the `normalizeEntity` function and related helpers

#### Scenario: Connector has webhooks module

- **WHEN** a connector handles webhooks
- **THEN** webhook logic SHALL be in a dedicated `webhooks.ts` module
- **AND** the module SHALL export `verifyWebhook`, `parseWebhookEvent`, and `extractEntity` functions

#### Scenario: Connector has sync module

- **WHEN** a connector performs data synchronization
- **THEN** sync logic SHALL be organized in a `sync/` directory
- **AND** orchestration logic SHALL be in `sync/index.ts`
- **AND** resource-specific sync functions MAY be in separate files

#### Scenario: Connector index re-exports

- **WHEN** the connector's `index.ts` is imported
- **THEN** it SHALL export the connector object implementing the Connector interface
- **AND** it SHALL export connector metadata

## ADDED Requirements

### Requirement: Connector Factory Pattern

Connectors SHALL be exposed as factory functions for explicit configuration.

#### Scenario: Connector factory returns configured instance

- **WHEN** a user calls `stripeConnector()` from the library
- **THEN** it SHALL return a `Connector` instance
- **AND** the instance SHALL be ready for use with the connector registry

#### Scenario: Factory accepts optional overrides

- **WHEN** a connector factory is called with options
- **THEN** it MAY accept configuration overrides
- **AND** overrides SHALL be merged with defaults

### Requirement: Config-Based Connector Resolution

The library SHALL resolve connectors based on the configuration passed to handlers.

#### Scenario: Handlers receive config parameter

- **WHEN** `createWebhookHandler(config)` is called
- **THEN** the handler SHALL use the passed config to resolve connectors
- **AND** the handler SHALL NOT import configuration from external files

#### Scenario: Connector lookup uses passed config

- **WHEN** a webhook handler processes a request for `app_key`
- **THEN** it SHALL call `getConnectorForAppKey(appKey, config)`
- **AND** the config SHALL be the same object passed to `createWebhookHandler`
