## ADDED Requirements

### Requirement: Sync Jobs Table

The system SHALL provide a `supasaasy.sync_jobs` table to track synchronization job metadata and progress.

#### Scenario: Table structure complete

- **WHEN** the database is migrated
- **THEN** the `supasaasy.sync_jobs` table SHALL exist
- **AND** the table SHALL contain columns: `id`, `app_key`, `mode`, `resource_types`, `status`, `total_tasks`, `completed_tasks`, `failed_tasks`, `processed_entities`, `created_at`, `started_at`, `completed_at`, `error_message`, `needs_worker`, `worker_spawned_at`

#### Scenario: Primary key is UUID

- **WHEN** a sync job is created
- **THEN** the `id` column SHALL be a UUID primary key
- **AND** it SHALL be auto-generated

#### Scenario: Status enum enforced

- **WHEN** a sync job record is inserted or updated
- **THEN** the `status` column SHALL only accept values: `pending`, `processing`, `completed`, `failed`, `cancelled`

#### Scenario: Timestamp auto-set

- **WHEN** a sync job is created
- **THEN** `created_at` SHALL default to the current timestamp

#### Scenario: Query performance indexes

- **WHEN** querying sync jobs
- **THEN** indexes SHALL optimize queries by `id`, `app_key`, `status`, and `created_at`
- **AND** lookup by job ID SHALL be efficient

### Requirement: Sync Job Tasks Table

The system SHALL provide a `supasaasy.sync_job_tasks` table to track individual resource sync tasks within a sync job.

#### Scenario: Table structure complete

- **WHEN** the database is migrated
- **THEN** the `supasaasy.sync_job_tasks` table SHALL exist
- **AND** the table SHALL contain columns: `id`, `job_id`, `resource_type`, `status`, `entity_count`, `created_at`, `started_at`, `completed_at`, `error_message`, `cursor`, `last_heartbeat`

#### Scenario: Primary key is UUID

- **WHEN** a task record is created
- **THEN** the `id` column SHALL be a UUID primary key
- **AND** it SHALL be auto-generated

#### Scenario: Foreign key to sync jobs

- **WHEN** a task record is created
- **THEN** the `job_id` column SHALL reference `sync_jobs(id)`
- **AND** deletion of a job SHALL cascade to its tasks

#### Scenario: Status enum enforced

- **WHEN** a task record is inserted or updated
- **THEN** the `status` column SHALL only accept values: `pending`, `processing`, `completed`, `failed`

#### Scenario: Resource type uniqueness per job

- **WHEN** task records are created for a job
- **THEN** the combination of `(job_id, resource_type)` SHALL be unique
- **AND** this SHALL prevent duplicate resource processing within a job

#### Scenario: Query performance indexes

- **WHEN** querying tasks
- **THEN** indexes SHALL optimize queries by `job_id` and `status`
- **AND** finding pending tasks for a job SHALL be efficient

### Requirement: Job Database Operations

The system SHALL provide database helper functions for job management.

#### Scenario: Create job helper available

- **WHEN** the sync handler needs to create a job
- **THEN** a `createSyncJob()` function SHALL be available
- **AND** it SHALL accept job parameters and return the created job record

#### Scenario: Update job status helper available

- **WHEN** job status needs to be updated
- **THEN** an `updateJobStatus()` function SHALL be available
- **AND** it SHALL atomically update status, counters, and timestamps

#### Scenario: Create tasks helper available

- **WHEN** tasks need to be created for a job
- **THEN** a `createJobTasks()` function SHALL be available
- **AND** it SHALL accept an array of resource types
- **AND** it SHALL insert all tasks in a single operation

#### Scenario: Claim task helper available

- **WHEN** a worker needs to claim a pending task
- **THEN** a `claimTask()` function SHALL be available
- **AND** it SHALL atomically update task status from `pending` to `processing`
- **AND** it SHALL return the claimed task or null if none available

#### Scenario: Update task status helper available

- **WHEN** a worker completes or fails task processing
- **THEN** an `updateTaskStatus()` function SHALL be available
- **AND** it SHALL update task status, entity_count, and timestamps atomically

#### Scenario: Update task heartbeat helper available

- **WHEN** a worker needs to indicate it is still processing
- **THEN** an `updateTaskHeartbeat()` function SHALL be available
- **AND** it SHALL update the task's `last_heartbeat` timestamp
- **AND** it MAY update the cursor and entity count for progress tracking

#### Scenario: Get job status helper available

- **WHEN** querying job progress
- **THEN** a `getJobStatus()` function SHALL be available
- **AND** it SHALL return job metadata with aggregated task statistics
- **AND** it SHALL include progress percentage based on completed/total tasks

#### Scenario: Cleanup old jobs helper available

- **WHEN** cleaning up completed jobs
- **THEN** a `cleanupOldJobs()` function SHALL be available
- **AND** it SHALL delete jobs and their tasks older than a specified retention period
