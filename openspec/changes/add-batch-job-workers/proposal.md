# Change: Add Batch Job Processing with Workers

## Why

Supabase Edge Functions have strict resource limits (50 seconds wall time, 10 seconds CPU time, ~512MB memory) that make them unsuitable for long-running synchronization operations with large datasets. When syncing thousands of entities, the sync operation times out before completion, resulting in partial data syncs and poor user experience.

By introducing a batch job processing system with worker functions, we can process large syncs in manageable chunks that each complete within edge function limits, enabling reliable synchronization of datasets of any size.

## What Changes

- Add `supasaasy.sync_jobs` table to track job metadata, status, and progress
- Add `supasaasy.sync_job_chunks` table to manage individual work units
- Modify sync endpoint handler to create job records and spawn workers instead of running synchronously
- Create worker edge function pattern for processing job chunks
- Add `GET /sync/jobs/{job_id}` endpoint for querying job status and progress
- Implement estimated time to completion calculation based on chunk processing rates
- Ensure job processing is idempotent and resumable after failures
- Add job cleanup mechanism for completed jobs

## Impact

- **Affected specs:**
  - `data-model`: New `sync_jobs` and `sync_job_chunks` tables
  - `periodic-sync`: Modified sync behavior to use job-based processing
  - `connector-interface`: Optional chunking interface for connectors to optimize parallel processing

- **Affected code:**
  - `packages/supasaasy/src/handlers/sync.ts`: Modified to create jobs instead of running sync
  - `packages/supasaasy/src/handlers/job-status.ts`: New handler for job status queries
  - `packages/supasaasy/src/handlers/worker.ts`: New worker handler for processing chunks
  - `packages/supasaasy/src/db/index.ts`: New database operations for jobs and chunks
  - `examples/starter/supabase/functions/sync/`: Modified to use new job-based approach
  - `examples/starter/supabase/functions/worker/`: New worker function
  - `examples/starter/supabase/functions/job-status/`: New job status endpoint

- **Breaking changes:** None. The sync endpoint API remains backward compatible, but responses now return job status instead of immediate results.
