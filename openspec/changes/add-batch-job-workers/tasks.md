## 1. Database Schema

- [x] 1.1 Create `supasaasy.sync_jobs` table migration with columns: `id`, `app_key`, `mode`, `resource_types`, `status`, `total_tasks`, `completed_tasks`, `failed_tasks`, `processed_entities`, `created_at`, `started_at`, `completed_at`, `error_message`
- [x] 1.2 Add status check constraint for `sync_jobs.status` enum values: `pending`, `processing`, `completed`, `failed`, `cancelled`
- [x] 1.3 Create indexes on `sync_jobs` for `(id)`, `(app_key)`, `(status)`, `(created_at)`
- [x] 1.4 Create `supasaasy.sync_job_tasks` table migration with columns: `id`, `job_id`, `resource_type`, `status`, `entity_count`, `created_at`, `started_at`, `completed_at`, `error_message`
- [x] 1.5 Add foreign key constraint from `sync_job_tasks.job_id` to `sync_jobs.id` with `ON DELETE CASCADE`
- [x] 1.6 Add status check constraint for `sync_job_tasks.status` enum values: `pending`, `processing`, `completed`, `failed`
- [x] 1.7 Add unique constraint on `sync_job_tasks(job_id, resource_type)`
- [x] 1.8 Create indexes on `sync_job_tasks` for `(job_id)`, `(status)`

## 2. Database Operations

- [x] 2.1 Implement `createSyncJob()` function in `src/db/index.ts` that inserts a job record and returns the created job
- [x] 2.2 Implement `updateJobStatus()` function that atomically updates job status, counters, and timestamps
- [x] 2.3 Implement `createJobTasks()` function that inserts task records for each resource type
- [x] 2.4 Implement `claimTask()` function that atomically updates task status from `pending` to `processing` and returns the task
- [x] 2.5 Implement `updateTaskStatus()` function that updates task status, entity_count, timestamps, and error_message
- [x] 2.6 Implement `getJobStatus()` function that returns job with aggregated task statistics and progress percentage
- [x] 2.7 Implement `cleanupOldJobs()` function that deletes jobs older than specified retention days (default 7)
- [ ] 2.8 Add unit tests for all database operations using mock Supabase client

## 3. Worker Handler

- [x] 3.1 Create `src/handlers/worker.ts` with `createWorkerHandler()` factory function
- [x] 3.2 Implement task claiming logic that exits gracefully if no tasks available
- [x] 3.3 Implement resource sync processing using connector's `fullSync()` or `incrementalSync()` methods for the task's resource type
- [x] 3.4 Implement task status update on success/failure with entity counts and error messages
- [x] 3.5 Implement job completion detection when last task finishes (update job status to `completed` or `failed`)
- [x] 3.6 Add timeout awareness - worker exits gracefully before edge function time limit
- [x] 3.7 Add error handling and logging for worker failures
- [ ] 3.8 Add worker unit tests covering task processing and edge cases

## 4. Modified Sync Handler

- [x] 4.1 Update `src/handlers/sync.ts` to create sync job with tasks instead of running sync synchronously
- [x] 4.2 Implement task creation logic - one task per resource type to sync
- [x] 4.3 Modify response format to include `job_id`, `status`, `total_tasks`, and `resource_types`
- [x] 4.4 Implement fallback to synchronous sync for small datasets (optional `immediate` mode flag)
- [ ] 4.5 Update sync handler tests to verify job creation and task creation

## 5. Job Status Handler

- [x] 5.1 Create `src/handlers/job-status.ts` with `createJobStatusHandler()` factory function
- [x] 5.2 Implement GET endpoint pattern `/sync/jobs/{job_id}` with job ID extraction from URL
- [x] 5.3 Implement admin API key authentication (reuse existing auth logic)
- [x] 5.4 Implement job status retrieval using `getJobStatus()` database function
- [x] 5.5 Implement 404 response for unknown job IDs
- [x] 5.6 Format response with job metadata, progress percentage, and task statistics
- [ ] 5.7 Add job status handler unit tests

## 6. Example Function Setup

- [x] 6.1 Create `examples/starter/supabase/functions/worker/index.ts` using `createWorkerHandler()`
- [x] 6.2 Update `examples/starter/supabase/functions/sync/index.ts` to use modified job-based sync
- [x] 6.3 Create `examples/starter/supabase/functions/job-status/index.ts` using `createJobStatusHandler()`
- [x] 6.4 Update `examples/starter/supabase/config.toml` with worker and job-status function definitions
- [x] 6.5 Add README documentation for new endpoints and job-based sync workflow

## 7. Integration Testing

- [ ] 7.1 Test full sync job creation and verify tasks are created per resource type
- [ ] 7.2 Test worker processing of individual tasks
- [ ] 7.3 Test job status endpoint polling during active job
- [ ] 7.4 Test job completion detection and final status
- [ ] 7.5 Test task failure handling and error reporting
- [ ] 7.6 Test job cleanup for old completed jobs

## 8. Documentation

- [x] 8.1 Update main README with job-based sync explanation and migration notes
- [x] 8.2 Document new API endpoints: `POST /sync` (modified response), `GET /sync/jobs/{job_id}`
- [x] 8.3 Document worker endpoint (internal, not user-facing)
- [ ] 8.4 Add architecture diagram showing job/task/worker flow
- [x] 8.5 Document migration path for existing deployments
- [ ] 8.6 Add troubleshooting guide for common job/worker issues
