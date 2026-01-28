## ADDED Requirements

### Requirement: Test Runner Configuration

The system SHALL use Deno's built-in test runner for unit testing.

#### Scenario: Test task available

- **WHEN** a developer runs `deno task test`
- **THEN** all test files matching `**/*.test.ts` SHALL be discovered and executed
- **AND** test results SHALL be reported to stdout

#### Scenario: Test watch mode available

- **WHEN** a developer runs `deno task test:watch`
- **THEN** tests SHALL re-run automatically when source files change

#### Scenario: Test coverage available

- **WHEN** a developer runs `deno task test:coverage`
- **THEN** test coverage report SHALL be generated

### Requirement: Test File Organization

Test files SHALL follow a consistent naming and location convention.

#### Scenario: Test file naming

- **WHEN** a test file is created
- **THEN** it SHALL use the `.test.ts` suffix

#### Scenario: Test file location for modules

- **WHEN** testing a module (e.g., `config.ts`)
- **THEN** the test file SHALL be co-located as `config.test.ts` OR placed in a `__tests__/` directory

#### Scenario: Test file location for connectors

- **WHEN** testing a connector
- **THEN** connector-specific tests SHALL be in `connectors/<name>/__tests__/`
- **AND** shared conformance tests SHALL be in `connectors/__tests__/`

### Requirement: Connector Conformance Test Suite

The system SHALL provide a reusable test suite that validates connectors against the interface specification.

#### Scenario: Conformance suite validates metadata

- **WHEN** a connector is tested with the conformance suite
- **THEN** it SHALL verify the connector has valid metadata
- **AND** metadata SHALL include name, displayName, version, apiVersion
- **AND** metadata SHALL include at least one supported resource

#### Scenario: Conformance suite validates webhook interface

- **WHEN** a connector is tested with the conformance suite
- **THEN** it SHALL verify the connector implements verifyWebhook
- **AND** it SHALL verify the connector implements parseWebhookEvent
- **AND** it SHALL verify the connector implements extractEntity

#### Scenario: Conformance suite validates sync interface

- **WHEN** a connector is tested with the conformance suite
- **THEN** it SHALL verify the connector implements fullSync
- **AND** it SHALL optionally verify incrementalSync if metadata indicates support

#### Scenario: Conformance suite validates normalization

- **WHEN** a connector is tested with the conformance suite
- **THEN** it SHALL verify normalizeEntity produces valid NormalizedEntity objects
- **AND** the output SHALL have externalId, appKey, collectionKey, and rawPayload

### Requirement: Mock Utilities

The test infrastructure SHALL provide utilities for mocking external dependencies.

#### Scenario: Database mock available

- **WHEN** testing code that uses database functions
- **THEN** mock implementations of `upsertEntities`, `deleteEntity`, `getEntityExternalIds` SHALL be available
- **AND** mocks SHALL allow verification of calls and custom return values

#### Scenario: Connector mock factory available

- **WHEN** testing code that uses connectors
- **THEN** a mock connector factory SHALL be available
- **AND** it SHALL produce connectors that conform to the interface

### Requirement: CI Test Integration

Unit tests SHALL run automatically in the CI pipeline.

#### Scenario: Tests run on pull request

- **WHEN** a pull request is opened or updated
- **THEN** the CI workflow SHALL run all unit tests
- **AND** test failures SHALL block the pull request from merging

#### Scenario: Tests run on push to main

- **WHEN** code is pushed to the main branch
- **THEN** the CI workflow SHALL run all unit tests
- **AND** test failures SHALL be reported

#### Scenario: Deployment requires tests to pass

- **WHEN** deploying functions or migrations
- **THEN** the deployment workflow SHALL require the test job to have passed
- **AND** deployment SHALL NOT proceed if tests failed

### Requirement: Stripe Connector Test Coverage

The Stripe connector SHALL have unit tests covering its implementation.

#### Scenario: Webhook verification tested

- **WHEN** Stripe connector tests run
- **THEN** webhook signature verification SHALL be tested with valid signatures
- **AND** it SHALL be tested with invalid signatures
- **AND** it SHALL be tested with missing signatures

#### Scenario: Event parsing tested

- **WHEN** Stripe connector tests run
- **THEN** parsing SHALL be tested for customer events
- **AND** parsing SHALL be tested for subscription events
- **AND** parsing SHALL be tested for product and price events

#### Scenario: Entity normalization tested

- **WHEN** Stripe connector tests run
- **THEN** normalization SHALL be tested for each supported resource type
- **AND** archived_at detection SHALL be tested for canceled subscriptions

#### Scenario: Sync filtering tested

- **WHEN** Stripe connector tests run
- **THEN** sync_from filtering SHALL be tested for full sync
- **AND** sync_from SHALL be verified to not affect incremental sync
