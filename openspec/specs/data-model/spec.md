# data-model Specification

## Purpose

TBD - created by archiving change 02-add-core-schema. Update Purpose after archive.
## Requirements
### Requirement: Canonical Entities Table

The system SHALL store all SaaS data in a single canonical `supasaasy.entities` table.

#### Scenario: Table structure complete

- **WHEN** the database is migrated
- **THEN** the `supasaasy.entities` table SHALL exist
- **AND** the table SHALL contain columns: `id`, `external_id`, `app_key`, `collection_key`, `api_version`, `raw_payload`, `created_at`, `updated_at`, `archived_at`, `deleted_at`

#### Scenario: Primary key is UUID

- **WHEN** an entity is inserted
- **THEN** the `id` column SHALL be a UUID primary key
- **AND** it SHALL be auto-generated if not provided

### Requirement: Idempotency Constraint

The system SHALL enforce idempotency via a unique constraint on entity identification.

#### Scenario: Duplicate insert prevented

- **WHEN** an entity with the same `(app_key, collection_key, external_id)` is inserted
- **THEN** the insert SHALL fail with a unique constraint violation
- **AND** an upsert operation SHALL update the existing record instead

#### Scenario: Same external_id allowed across apps

- **WHEN** two different `app_key` values have entities with the same `external_id`
- **THEN** both records SHALL be stored successfully
- **AND** they SHALL be treated as distinct entities

### Requirement: JSONB Payload Storage

The system SHALL store the full SaaS entity data in a JSONB column.

#### Scenario: Raw payload stored

- **WHEN** an entity is synced from a SaaS provider
- **THEN** the complete API response SHALL be stored in `raw_payload`
- **AND** the data SHALL be queryable using JSONB operators

#### Scenario: API version tracked

- **WHEN** an entity is synced
- **THEN** the `api_version` column SHALL record the upstream API version
- **AND** this SHALL enable future schema migration handling

### Requirement: Timestamp Management

The system SHALL automatically manage timestamp columns.

#### Scenario: Created timestamp auto-set

- **WHEN** a new entity is inserted
- **THEN** `created_at` SHALL default to the current timestamp

#### Scenario: Updated timestamp auto-updated

- **WHEN** an existing entity is modified
- **THEN** `updated_at` SHALL be automatically set to the current timestamp

#### Scenario: Archived timestamp nullable

- **WHEN** an entity is soft-deleted upstream (archived, inactive, trashed)
- **THEN** `archived_at` SHALL be set to the current timestamp
- **AND** the record SHALL remain in the database

### Requirement: Query Performance Indexes

The system SHALL provide indexes for common query patterns.

#### Scenario: Filter by app instance

- **WHEN** querying entities for a specific `app_key`
- **THEN** an index SHALL optimize the query

#### Scenario: Filter by collection type

- **WHEN** querying entities for a specific `collection_key`
- **THEN** an index SHALL optimize the query

#### Scenario: Lookup by external ID

- **WHEN** looking up an entity by `external_id`
- **THEN** an index SHALL optimize the query

### Requirement: Database Utilities

The system SHALL provide shared database utilities for Edge Functions.

#### Scenario: Upsert helper available

- **WHEN** a connector needs to insert or update an entity
- **THEN** a shared upsert function SHALL handle the operation
- **AND** it SHALL use the unique constraint for conflict resolution

#### Scenario: Delete helper available

- **WHEN** a connector needs to delete an entity
- **THEN** a shared delete function SHALL handle physical deletion

#### Scenario: Parameterized queries only

- **WHEN** database operations are performed
- **THEN** all queries SHALL use parameterized queries via Supabase's query builder
- **AND** raw SQL string execution SHALL NOT be available
- **AND** this SHALL prevent SQL injection vulnerabilities

