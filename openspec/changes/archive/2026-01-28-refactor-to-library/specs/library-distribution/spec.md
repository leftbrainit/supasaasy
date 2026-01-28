## ADDED Requirements

### Requirement: JSR Package Publishing

The library SHALL be published to JSR as a Deno-native package.

#### Scenario: Package available on JSR

- **WHEN** a user wants to install SupaSaaSy
- **THEN** they SHALL be able to install via `deno add jsr:@supasaasy/core`
- **AND** the package SHALL be available at jsr.io/@supasaasy/core

#### Scenario: Package includes TypeScript types

- **WHEN** the package is installed
- **THEN** all public APIs SHALL have TypeScript type definitions
- **AND** types SHALL be available without additional @types package

#### Scenario: Package versioning follows semver

- **WHEN** breaking changes are made
- **THEN** the major version SHALL be incremented
- **AND** migration guides SHALL be provided in release notes

### Requirement: Handler Factory Functions

The library SHALL export factory functions for creating Edge Function handlers.

#### Scenario: Webhook handler factory

- **WHEN** a user creates a webhook Edge Function
- **THEN** they SHALL call `createWebhookHandler(config)` with their configuration
- **AND** the returned handler SHALL be compatible with `Deno.serve()`

#### Scenario: Sync handler factory

- **WHEN** a user creates a sync Edge Function
- **THEN** they SHALL call `createSyncHandler(config)` with their configuration
- **AND** the returned handler SHALL be compatible with `Deno.serve()`

#### Scenario: Handler accepts runtime config

- **WHEN** a handler factory is called
- **THEN** it SHALL accept a `SupaSaaSyConfig` object
- **AND** the config SHALL be validated at handler creation time

### Requirement: Configuration Helper

The library SHALL export a `defineConfig` helper for type-safe configuration.

#### Scenario: defineConfig provides type inference

- **WHEN** a user writes `defineConfig({ ... })`
- **THEN** TypeScript SHALL provide autocompletion for config properties
- **AND** type errors SHALL be shown for invalid configurations

#### Scenario: defineConfig validates at runtime

- **WHEN** `defineConfig()` is called with invalid configuration
- **THEN** a descriptive error SHALL be thrown
- **AND** the error SHALL identify the invalid field and expected type

#### Scenario: Configuration structure unchanged

- **WHEN** migrating from scaffold to library
- **THEN** the `apps` and `sync_schedules` structure SHALL remain the same
- **AND** existing configuration values SHALL work without modification

### Requirement: Migration Generation Function

The library SHALL expose a `getMigrations()` function for generating SQL migrations.

#### Scenario: getMigrations returns SQL string

- **WHEN** `getMigrations(config)` is called with a configuration
- **THEN** it SHALL return a string containing all required SQL migrations
- **AND** the SQL SHALL include core schema and connector-specific views

#### Scenario: Migrations include only configured connectors

- **WHEN** `getMigrations(config)` is called
- **THEN** only migrations for connectors referenced in `config.apps` SHALL be included
- **AND** unused connector migrations SHALL NOT be included

#### Scenario: Migrations are idempotent

- **WHEN** the generated SQL is applied multiple times
- **THEN** it SHALL use `CREATE OR REPLACE` and `IF NOT EXISTS` patterns
- **AND** re-running SHALL NOT cause errors or data loss

#### Scenario: Migration includes source comments

- **WHEN** migrations are generated
- **THEN** the SQL SHALL include comments identifying the SupaSaaSy version
- **AND** comments SHALL identify which connector each section belongs to

### Requirement: Connector Exports

The library SHALL export connectors individually for tree-shaking.

#### Scenario: Individual connector imports

- **WHEN** a user only needs the Stripe connector
- **THEN** they MAY import `import { stripeConnector } from 'supasaasy'`
- **AND** other connectors SHALL NOT be bundled

#### Scenario: All connectors available from main export

- **WHEN** a user imports from the main module
- **THEN** all official connectors SHALL be available
- **AND** the connector registry SHALL be pre-populated

#### Scenario: Connector metadata exported

- **WHEN** a user needs connector information
- **THEN** they SHALL be able to access `connector.metadata`
- **AND** metadata SHALL include name, supported resources, and API version

### Requirement: Type Exports

The library SHALL export all public types for user code.

#### Scenario: Configuration types exported

- **WHEN** a user needs to type their configuration
- **THEN** `SupaSaaSyConfig`, `AppConfig`, and `SyncSchedule` types SHALL be exported

#### Scenario: Entity types exported

- **WHEN** a user works with synced data
- **THEN** `NormalizedEntity` and related types SHALL be exported

#### Scenario: Connector interface types exported

- **WHEN** a user wants to understand connector capabilities
- **THEN** `Connector`, `ConnectorMetadata`, and related interfaces SHALL be exported
