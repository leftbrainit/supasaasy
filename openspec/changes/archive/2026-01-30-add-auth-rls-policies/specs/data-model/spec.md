## ADDED Requirements

### Requirement: Authorized Users Table

The system SHALL provide a `supasaasy.users` table to manage users authorized to access SupaSaaSy data.

#### Scenario: Table structure complete

- **WHEN** the database is migrated with auth enabled
- **THEN** the `supasaasy.users` table SHALL exist
- **AND** the table SHALL contain columns: `id`, `user_id`, `created_at`
- **AND** `user_id` SHALL reference `auth.users(id)` with cascade delete

#### Scenario: Primary key is UUID

- **WHEN** a user entry is inserted
- **THEN** the `id` column SHALL be a UUID primary key
- **AND** it SHALL be auto-generated if not provided

#### Scenario: User ID is unique

- **WHEN** attempting to add the same user_id twice
- **THEN** the insert SHALL fail with a unique constraint violation
- **AND** this SHALL prevent duplicate authorization entries

#### Scenario: Timestamp auto-set

- **WHEN** a user entry is inserted
- **THEN** `created_at` SHALL default to the current timestamp

#### Scenario: Query performance index

- **WHEN** RLS policies check user authorization
- **THEN** an index on `user_id` SHALL optimize the lookup

### Requirement: Row Level Security on Entities Table

The system SHALL enable Row Level Security on the entities table when auth is enabled.

#### Scenario: RLS enabled

- **WHEN** the database is migrated with auth enabled
- **THEN** RLS SHALL be enabled on `supasaasy.entities`

#### Scenario: Authorized users can SELECT

- **WHEN** an authenticated user listed in `supasaasy.users` queries the entities table
- **THEN** the SELECT SHALL succeed
- **AND** all rows SHALL be visible to the user

#### Scenario: Unauthorized users denied SELECT

- **WHEN** an authenticated user NOT listed in `supasaasy.users` queries the entities table
- **THEN** the SELECT SHALL return zero rows
- **AND** no error SHALL be raised (standard RLS behavior)

#### Scenario: Service role bypasses RLS

- **WHEN** a query is executed with `service_role` key
- **THEN** RLS SHALL be bypassed
- **AND** all rows SHALL be accessible for backend operations

### Requirement: Row Level Security on Sync State Table

The system SHALL enable Row Level Security on the sync_state table when auth is enabled.

#### Scenario: RLS enabled

- **WHEN** the database is migrated with auth enabled
- **THEN** RLS SHALL be enabled on `supasaasy.sync_state`

#### Scenario: Authorized users can SELECT

- **WHEN** an authenticated user listed in `supasaasy.users` queries the sync_state table
- **THEN** the SELECT SHALL succeed

#### Scenario: Unauthorized users denied SELECT

- **WHEN** an authenticated user NOT listed in `supasaasy.users` queries the sync_state table
- **THEN** the SELECT SHALL return zero rows

### Requirement: Row Level Security on Webhook Logs Table

The system SHALL enable Row Level Security on the webhook_logs table when auth is enabled.

#### Scenario: RLS enabled

- **WHEN** the database is migrated with auth enabled
- **THEN** RLS SHALL be enabled on `supasaasy.webhook_logs`

#### Scenario: Authorized users can SELECT

- **WHEN** an authenticated user listed in `supasaasy.users` queries the webhook_logs table
- **THEN** the SELECT SHALL succeed

#### Scenario: Unauthorized users denied SELECT

- **WHEN** an authenticated user NOT listed in `supasaasy.users` queries the webhook_logs table
- **THEN** the SELECT SHALL return zero rows

### Requirement: Row Level Security on Sync Jobs Table

The system SHALL enable Row Level Security on the sync_jobs table when auth is enabled.

#### Scenario: RLS enabled

- **WHEN** the database is migrated with auth enabled
- **THEN** RLS SHALL be enabled on `supasaasy.sync_jobs`

#### Scenario: Authorized users can SELECT

- **WHEN** an authenticated user listed in `supasaasy.users` queries the sync_jobs table
- **THEN** the SELECT SHALL succeed

#### Scenario: Unauthorized users denied SELECT

- **WHEN** an authenticated user NOT listed in `supasaasy.users` queries the sync_jobs table
- **THEN** the SELECT SHALL return zero rows

### Requirement: Row Level Security on Sync Job Tasks Table

The system SHALL enable Row Level Security on the sync_job_tasks table when auth is enabled.

#### Scenario: RLS enabled

- **WHEN** the database is migrated with auth enabled
- **THEN** RLS SHALL be enabled on `supasaasy.sync_job_tasks`

#### Scenario: Authorized users can SELECT

- **WHEN** an authenticated user listed in `supasaasy.users` queries the sync_job_tasks table
- **THEN** the SELECT SHALL succeed

#### Scenario: Unauthorized users denied SELECT

- **WHEN** an authenticated user NOT listed in `supasaasy.users` queries the sync_job_tasks table
- **THEN** the SELECT SHALL return zero rows

### Requirement: Auth Configuration

The system SHALL allow configuration of auth and RLS behavior.

#### Scenario: Auth enabled by default

- **WHEN** no auth configuration is provided
- **THEN** auth SHALL be enabled by default
- **AND** RLS policies SHALL be included in generated migrations

#### Scenario: Auth explicitly enabled

- **WHEN** the configuration includes `auth: { enabled: true }`
- **THEN** RLS policies SHALL be included in generated migrations

#### Scenario: Auth disabled via config

- **WHEN** the configuration includes `auth: { enabled: false }`
- **THEN** RLS policies SHALL NOT be included in generated migrations
- **AND** tables SHALL remain accessible to all authenticated users

### Requirement: User Management Helper

The system SHALL provide documentation for managing authorized users.

#### Scenario: Adding a user

- **WHEN** an administrator wants to authorize a user
- **THEN** they SHALL insert into `supasaasy.users (user_id)` with the UUID from `auth.users`
- **AND** the user SHALL immediately gain access to SupaSaaSy tables

#### Scenario: Removing a user

- **WHEN** an administrator wants to revoke a user's access
- **THEN** they SHALL delete from `supasaasy.users` where `user_id` matches
- **AND** the user SHALL immediately lose access to SupaSaaSy tables

#### Scenario: User deletion cascades

- **WHEN** a user is deleted from `auth.users`
- **THEN** the corresponding `supasaasy.users` entry SHALL be automatically deleted
- **AND** this SHALL be handled by the foreign key cascade
