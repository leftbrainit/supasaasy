# Design Document: Batch Job Processing with Workers

## Context

Supabase Edge Functions run on Deno Deploy with strict resource limits:
- **CPU time:** ~10 seconds CPU execution time
- **Wall time:** ~50 seconds total execution time
- **Memory:** ~512MB per function invocation

Large sync operations (e.g., initial backfill of 10,000+ Stripe customers) exceed these limits, causing:
- Incomplete syncs due to timeouts
- Poor user experience with no progress visibility
- Inability to resume failed syncs
- Resource exhaustion errors

The current sync handler processes all entities synchronously in a single request-response cycle, making it impossible to handle large datasets reliably.

## Goals / Non-Goals

**Goals:**
- Enable synchronization of arbitrarily large datasets within edge function constraints
- Provide real-time visibility into sync progress
- Support resumable syncs that survive transient failures
- Maintain backward compatibility with existing sync API
- Work correctly with all pagination styles (cursor-based, offset-based, etc.)

**Non-Goals:**
- Replace the existing incremental sync for small datasets (keep it fast for common case)
- Implement distributed worker coordination beyond Supabase functions
- Add complex scheduling/queueing systems (keep it simple)
- Support cross-region job distribution
- Pre-calculate total entity counts or chunk sizes (connectors vary too much)

## Decisions

### Architecture: Task-Based Job Queue with Serial Processing

**Decision:** Implement a job queue pattern where the sync endpoint creates one task per resource type, and workers process each task completely using the connector's natural pagination. Workers process tasks serially to stay within edge function limits.

**Key insight:** Different APIs have different pagination styles and limits:
- Stripe: Cursor-based, 100 records per page
- Notion: Cursor-based, 100 records per page (max)
- Intercom: Cursor-based, variable page sizes

Rather than pre-chunking with offsets (which doesn't work for cursor-based APIs), we let each connector handle its own pagination internally.

**Flow:**
1. Client calls `POST /sync` with `{ app_key: "stripe_main", mode: "full" }`
2. Sync handler:
   - Creates a `sync_jobs` record with status `pending`
   - Creates one `sync_job_tasks` record per resource type to sync
   - Returns `{ job_id: "...", status: "pending", total_tasks: 3 }`
3. Client starts worker function:
   - `POST /worker` with optional `{ job_id: "..." }` to target specific job
4. Worker function (polling-based):
   - Claim a pending task atomically
   - Call connector's fullSync() for that resource type (connector handles pagination internally)
   - Update task status to `completed` or `failed` with entity count
   - Continue to next task until no pending tasks remain or timeout approaches
   - Self-terminate gracefully near edge function time limit
5. Client polls `GET /sync/jobs/{job_id}` for progress updates
6. Job completes when all tasks are processed

**Alternatives considered:**
- **Pre-chunking with offsets:** Doesn't work for cursor-based APIs like Notion
- **Parallel workers:** Adds complexity; serial processing is simpler and sufficient
- **HTTP-based worker spawning:** Failed due to Edge Runtime network isolation in local development

**Rationale:** This approach is simpler and universally compatible:
- Connectors already handle pagination correctly for their APIs
- No need to know total entity counts upfront
- No assumptions about page sizes or API limits
- Workers just need to call the existing sync methods

### Task Granularity: One Task per Resource Type

**Decision:** Create one task per resource type (e.g., `customers`, `subscriptions`, `pages`). Each task represents a complete sync of that resource.

**Rationale:**
- Natural unit of work that maps to connector capabilities
- Allows progress tracking at resource level
- Failed tasks can be retried independently
- No need to track pagination state in the database

**Schema:**
```sql
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  app_key TEXT NOT NULL,
  mode TEXT NOT NULL, -- 'full' or 'incremental'
  resource_types TEXT[], -- resources to sync
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  failed_tasks INT DEFAULT 0,
  processed_entities INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE sync_job_tasks (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES sync_jobs(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  entity_count INT, -- actual count after processing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(job_id, resource_type)
);
```

### Worker Behavior: Serial Task Processing with Timeout Awareness

**Decision:** Workers process tasks one at a time, checking elapsed time before claiming each new task to ensure graceful completion within the edge function time limit.

**Flow:**
```typescript
async function processTasks() {
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 45000; // Leave 5s buffer before 50s limit
  
  while (true) {
    // Check if we have time for another task
    if (Date.now() - startTime > MAX_RUNTIME_MS) {
      console.log('Approaching time limit, exiting gracefully');
      break;
    }
    
    // Atomically claim next pending task
    const task = await claimTask(jobId);
    if (!task) break; // No more work
    
    // Process entire resource using connector's pagination
    const result = await connector.fullSync(appConfig, {
      resourceTypes: [task.resource_type]
    });
    
    // Update task status
    await updateTaskStatus(task.id, result.success ? 'completed' : 'failed', {
      entity_count: result.created + result.updated,
      error_message: result.errorMessages?.join('; ')
    });
    
    // Check if job is complete
    await checkJobCompletion(task.job_id);
  }
}
```

**Rationale:**
- Simple serial processing avoids race conditions
- Timeout awareness prevents hard timeouts mid-sync
- Each task is a complete unit of work (no partial state to track)
- Connector handles pagination internally, so worker doesn't need to manage cursors

### Progress Tracking: Task-Based Metrics

**Decision:** Track progress at task granularity. Entity counts are recorded after each task completes.

**Rationale:**
- Simple aggregation: `completed_tasks / total_tasks` = progress %
- Entity counts provide detail for completed resources
- No need for estimated entity counts (which would be inaccurate anyway)

### Handling Large Resource Collections

**Concern:** Some resources may have millions of entities, taking longer than the 50s edge function limit.

**Mitigation strategies:**
1. **Connector-level pagination:** Connectors already process entities in batches, upserting as they go. Even if the worker times out, partial progress is persisted.
2. **Task retry:** If a task times out, it remains in `processing` status. A timeout mechanism (e.g., mark as `failed` after 5 minutes) allows retry.
3. **Incremental sync:** For very large collections, use incremental sync mode which only fetches recent changes.
4. **sync_from filter:** App config can specify `sync_from` to limit historical data.

**Future enhancement:** Add cursor persistence to tasks so workers can resume from where they left off within a single resource sync. Not needed for MVP since most resources complete within time limits.

## Risks / Trade-offs

**Risk: Single resource exceeds time limit**
- Mitigated by: Connector pagination persists progress incrementally
- Mitigated by: sync_from filter to limit historical data
- Future: Add cursor persistence for resumable task processing

**Risk: Orphaned tasks if worker crashes**
- Mitigated by: Task timeout mechanism (mark as `failed` after 5 minutes without update)
- Recovery: Failed tasks can be retried manually

**Risk: Increased database load from job/task updates**
- Minimal impact: Only one update per task (not per page/entity)
- Acceptable trade-off for enabling large syncs

**Trade-off: Latency for small syncs**
- Impact: Small syncs now have overhead for job creation
- Mitigation: `immediate` mode flag falls back to synchronous processing

**Trade-off: No parallel processing**
- Impact: Slower than parallel workers for multi-resource syncs
- Rationale: Simplicity over speed; serial processing is reliable and predictable
- Future: Can add parallel workers later if needed

## Migration Plan

**Phase 1: Refactor database schema**
- Replace `sync_job_chunks` with `sync_job_tasks` (simpler schema)
- Update database helper functions
- No breaking changes to existing sync behavior

**Phase 2: Refactor handlers**
- Update sync handler to create tasks instead of chunks
- Update worker handler to process complete resource syncs
- Update job-status handler for task-based metrics

**Phase 3: Test and validate**
- Test with Stripe (cursor-based, well-behaved)
- Test with Notion (cursor-based, 100 record limit)
- Test with various collection sizes

**Rollback:** If task-based processing proves problematic, the original immediate sync handler remains available via `immediate: true` flag.

## Open Questions

1. **Should we add cursor persistence for resumable tasks?** Would help with very large collections but adds complexity.
2. **What retention policy for completed jobs?** Suggest auto-delete after 7 days to prevent table bloat.
3. **How to handle job cancellation?** Add `cancelled` status and cancel endpoint for long-running jobs?
