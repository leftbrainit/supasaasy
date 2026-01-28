## ADDED Requirements

### Requirement: Connector Migration Files

Each connector SHALL include database migrations in a `migrations/` subdirectory.

#### Scenario: Migration directory structure

- **WHEN** a connector is created
- **THEN** it SHALL have a `migrations/` directory
- **AND** migrations SHALL be numbered SQL files (e.g., `001_views.sql`, `002_indexes.sql`)

#### Scenario: Migration idempotency

- **WHEN** connector migrations are applied
- **THEN** they SHALL use idempotent SQL statements
- **AND** `CREATE OR REPLACE VIEW` SHALL be used for views
- **AND** `CREATE INDEX IF NOT EXISTS` SHALL be used for indexes

#### Scenario: Migration ordering

- **WHEN** multiple migration files exist in a connector
- **THEN** they SHALL be applied in numeric order based on filename prefix

### Requirement: Connector Migration Assembly

The system SHALL assemble connector migrations based on configuration.

#### Scenario: Only configured connectors included

- **WHEN** the migration assembly script runs
- **THEN** it SHALL read `supasaasy.config.ts` to identify configured connectors
- **AND** only migrations from configured connectors SHALL be included

#### Scenario: Combined migration generated

- **WHEN** connector migrations are assembled
- **THEN** a single combined SQL file SHALL be generated
- **AND** the file SHALL be placed in `supabase/migrations/`
- **AND** the file SHALL include comments identifying the source connectors

#### Scenario: No connectors configured

- **WHEN** no connectors are configured in `supasaasy.config.ts`
- **THEN** the assembly SHALL generate an empty or no-op migration file

## MODIFIED Requirements

### Requirement: Connector Metadata

Each connector SHALL provide metadata describing its capabilities and supported resources.

#### Scenario: Metadata includes provider name

- **WHEN** a connector is registered
- **THEN** it SHALL provide a unique provider name (e.g., "stripe", "intercom")

#### Scenario: Metadata lists supported resources

- **WHEN** a connector is registered
- **THEN** it SHALL list all supported resource types
- **AND** each resource SHALL map to a `collection_key` (e.g., "stripe_customer")

#### Scenario: Metadata includes API version

- **WHEN** a connector is registered
- **THEN** it SHALL specify the API version it targets

#### Scenario: Metadata includes migration info

- **WHEN** a connector is registered
- **THEN** it SHALL indicate whether it has migrations
- **AND** it SHALL provide the path to its migrations directory
