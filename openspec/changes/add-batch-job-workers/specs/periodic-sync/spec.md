## MODIFIED Requirements

### Requirement: Sync Endpoint

The system SHALL provide an endpoint for triggering synchronization via job-based processing.

#### Scenario: Manual sync trigger

- **WHEN** an authenticated request is made to the sync endpoint
- **THEN** a sync job SHALL be created for the specified app instance
- **AND** the response SHALL include the job ID, status, and resource types
- **AND** workers can be started to process the job

#### Scenario: Admin authentication required

- **WHEN** a sync request lacks valid admin API key
- **THEN** the system SHALL return 401 Unauthorized
- **AND** no sync job SHALL be created

#### Scenario: Admin key uses constant-time comparison

- **WHEN** verifying the admin API key
- **THEN** the system SHALL use constant-time string comparison
- **AND** the comparison SHALL NOT be vulnerable to timing attacks

#### Scenario: App key specified

- **WHEN** a sync request is made
- **THEN** the request SHALL specify which `app_key` to sync

#### Scenario: App key format validated

- **WHEN** a sync request is made with an app_key
- **THEN** the app_key SHALL be validated for format
- **AND** only alphanumeric characters, underscores, and hyphens SHALL be allowed
- **AND** invalid app_key formats SHALL return 400 Bad Request

#### Scenario: Request body size limited

- **WHEN** a sync request is received
- **THEN** the request body size SHALL be validated
- **AND** requests exceeding 1MB SHALL be rejected with 413 Payload Too Large

#### Scenario: Sync response includes job ID

- **WHEN** a sync request is successfully processed
- **THEN** the response SHALL include a `job_id` field
- **AND** the response SHALL include job `status` as `pending`
- **AND** the response SHALL include `total_tasks` and `resource_types`

### Requirement: Full Sync Mode

The system SHALL support full synchronization for backfills and reconciliation using task-based processing.

#### Scenario: Full sync creates job with tasks

- **WHEN** a full sync is requested
- **THEN** a sync job SHALL be created with status `pending`
- **AND** one task SHALL be created per resource type to sync
- **AND** each task represents a complete sync of that resource

#### Scenario: Full sync tasks process serially

- **WHEN** a full sync job is created
- **THEN** a worker function SHALL process tasks serially
- **AND** the worker SHALL exit gracefully before the edge function time limit

#### Scenario: Full sync handles pagination

- **WHEN** a task processes a resource type
- **THEN** the connector SHALL handle pagination internally
- **AND** all pages SHALL be processed within a single task
- **AND** API rate limits SHALL be respected

#### Scenario: Full sync detects deletions

- **WHEN** a task processes entities
- **THEN** entities existing in the database but not in the API response SHALL be physically deleted
- **AND** the deletion SHALL be logged

### Requirement: Incremental Sync Mode

The system SHALL support incremental synchronization for efficiency using task-based processing.

#### Scenario: Incremental sync creates job with tasks

- **WHEN** an incremental sync is requested
- **THEN** a sync job SHALL be created with status `pending`
- **AND** tasks SHALL be created for resources to sync
- **AND** if no previous sync state exists, the system SHALL perform a full sync instead

#### Scenario: Incremental sync uses timestamp

- **WHEN** a task performs incremental sync
- **THEN** the worker SHALL fetch only entities modified since last sync
- **AND** the last sync timestamp SHALL be retrieved from `sync_state` per (app_key, collection_key)

#### Scenario: Incremental sync updates state

- **WHEN** a task completes successfully
- **THEN** the sync state timestamp SHALL be updated for that resource type
- **AND** the timestamp SHALL reflect the completion time of the task

### Requirement: Scheduled Sync

The system SHALL support automated periodic synchronization using job-based processing.

#### Scenario: Cron schedule configured

- **WHEN** an app instance has a schedule in configuration
- **THEN** pg_cron SHALL trigger the sync function on that schedule
- **AND** the sync SHALL create a job as with manual triggers

#### Scenario: Schedule per app instance

- **WHEN** multiple app instances are configured
- **THEN** each MAY have its own sync schedule
- **AND** schedules SHALL be independent

#### Scenario: Scheduled sync is incremental

- **WHEN** a scheduled sync runs
- **THEN** it SHALL use incremental mode by default

### Requirement: Immediate Sync Mode

The system SHALL support immediate synchronous sync for small datasets.

#### Scenario: Immediate mode bypasses job creation

- **WHEN** a sync request includes `immediate: true`
- **THEN** the sync SHALL execute synchronously
- **AND** no job or task records SHALL be created
- **AND** the response SHALL include immediate results

## ADDED Requirements

### Requirement: Worker Endpoint

The system SHALL provide a worker endpoint for processing sync job tasks via database polling.

#### Scenario: Worker endpoint pattern

- **WHEN** a worker function is invoked
- **THEN** it SHALL accept a POST request with optional `{ job_id?: string, max_tasks?: number }`
- **AND** it SHALL poll the database for pending tasks

#### Scenario: Worker claims task atomically

- **WHEN** a worker finds a pending task
- **THEN** it SHALL atomically claim the task by updating status from `pending` to `processing`
- **AND** if the task is already claimed, the worker SHALL try the next pending task

#### Scenario: Worker processes resource

- **WHEN** a worker claims a task
- **THEN** it SHALL call the connector's sync method for the task's resource type
- **AND** the connector SHALL handle pagination internally
- **AND** the worker SHALL track the count of entities processed

#### Scenario: Worker updates task status

- **WHEN** a worker completes task processing
- **THEN** it SHALL update the task status to `completed` or `failed`
- **AND** it SHALL record the entity count and completion timestamp
- **AND** it SHALL record error messages if the task failed

#### Scenario: Worker updates sync state

- **WHEN** a worker completes a task successfully
- **THEN** it SHALL update the sync state for that resource type
- **AND** the timestamp SHALL reflect when the sync completed

#### Scenario: Worker timeout awareness

- **WHEN** a worker approaches the edge function time limit
- **THEN** it SHALL exit gracefully
- **AND** it SHALL NOT start processing a new task if timeout is imminent

#### Scenario: Worker idempotency

- **WHEN** a worker attempts to claim a task that is already processing
- **THEN** it SHALL skip that task
- **AND** it SHALL try to claim the next pending task

#### Scenario: Worker timeout handling

- **WHEN** a task remains in `processing` status for more than 5 minutes
- **THEN** the task MAY be marked as `failed` by a cleanup process
- **AND** the task MAY be retried

### Requirement: Job Status Endpoint

The system SHALL provide an endpoint for querying sync job status and progress.

#### Scenario: Status endpoint pattern

- **WHEN** a client queries job status
- **THEN** it SHALL send a GET request with the job ID (via path or query param)
- **AND** the system SHALL return current job status and progress

#### Scenario: Status response includes progress

- **WHEN** a job status is queried
- **THEN** the response SHALL include `total_tasks`, `completed_tasks`, `failed_tasks`
- **AND** the response SHALL include `processed_entities`
- **AND** the response SHALL include a `progress_percentage` field

#### Scenario: Status response includes task details

- **WHEN** a job status is queried with `include_tasks=true`
- **THEN** the response SHALL include an array of task details
- **AND** each task SHALL include resource_type, status, entity_count, and error_message

#### Scenario: Status endpoint requires authentication

- **WHEN** a status query is made without valid admin API key
- **THEN** the system SHALL return 401 Unauthorized

#### Scenario: Unknown job ID returns 404

- **WHEN** a status query is made for a non-existent job ID
- **THEN** the system SHALL return 404 Not Found

#### Scenario: Status includes error information

- **WHEN** a job status is queried for a failed job
- **THEN** the response SHALL include error details from failed tasks
- **AND** it SHALL NOT expose sensitive internal information

### Requirement: Job Completion Detection

The system SHALL automatically detect when all tasks are processed and update job status accordingly.

#### Scenario: Job marked complete when all tasks done

- **WHEN** the last task of a job completes successfully
- **THEN** the job status SHALL be updated to `completed`
- **AND** the `completed_at` timestamp SHALL be set

#### Scenario: Job marked failed if any tasks fail

- **WHEN** all tasks are finished and some have status `failed`
- **THEN** the job status SHALL be updated to `failed`
- **AND** the `error_message` MAY summarize the failures

#### Scenario: Job remains processing with pending tasks

- **WHEN** some tasks are `completed` or `failed`
- **AND** pending tasks remain
- **THEN** the job status SHALL remain `processing`
- **AND** workers SHALL continue processing pending tasks

### Requirement: Job Cleanup

The system SHALL provide mechanisms to clean up old job records and prevent unbounded table growth.

#### Scenario: Cleanup function available

- **WHEN** the system needs to clean up old jobs
- **THEN** a cleanup function SHALL delete jobs older than a configurable retention period
- **AND** the default retention period SHALL be 7 days

#### Scenario: Cleanup deletes job and tasks

- **WHEN** a job is cleaned up
- **THEN** the job record SHALL be deleted
- **AND** all associated task records SHALL be deleted via cascade

#### Scenario: Cleanup runs periodically

- **WHEN** configured in the deployment
- **THEN** job cleanup MAY be scheduled via pg_cron or similar mechanism
- **AND** it SHALL run at least daily
