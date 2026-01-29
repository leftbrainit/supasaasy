## MODIFIED Requirements

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
