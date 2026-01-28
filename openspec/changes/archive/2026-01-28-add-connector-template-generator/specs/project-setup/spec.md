## ADDED Requirements

### Requirement: Connector Template Generator

The project SHALL provide a generator script for scaffolding new connectors.

#### Scenario: Generator creates connector directory

- **WHEN** `deno task new-connector <name>` is run
- **THEN** a directory SHALL be created at `connectors/<name>/`
- **AND** the directory SHALL contain all required connector files

#### Scenario: Generator creates index with registration

- **WHEN** a connector is generated
- **THEN** `index.ts` SHALL be created with connector interface implementation
- **AND** the connector SHALL be registered with the registry
- **AND** placeholder methods SHALL be provided for all interface requirements

#### Scenario: Generator creates types file

- **WHEN** a connector is generated
- **THEN** `types.ts` SHALL be created with:
- **AND** resource type union placeholder
- **AND** collection keys mapping placeholder
- **AND** webhook event types mapping placeholder
- **AND** connector-specific config interface

#### Scenario: Generator creates sync module

- **WHEN** a connector is generated
- **THEN** `sync/index.ts` SHALL be created with fullSync and incrementalSync stubs
- **AND** `sync/resources.ts` SHALL be created with resource sync function template

#### Scenario: Generator creates test scaffolding

- **WHEN** a connector is generated
- **THEN** `__tests__/<name>.test.ts` SHALL be created
- **AND** it SHALL include the conformance test suite call
- **AND** it SHALL include placeholder tests for connector-specific behavior

#### Scenario: Generator creates migration placeholder

- **WHEN** a connector is generated
- **THEN** `migrations/001_views.sql` SHALL be created
- **AND** it SHALL contain commented placeholder SQL for views

#### Scenario: Generator validates connector name

- **WHEN** `deno task new-connector` is run with an invalid name
- **THEN** an error SHALL be shown if the name is not kebab-case
- **OR** if a connector with that name already exists
