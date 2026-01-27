## 1. Edge Function Setup
- [x] 1.1 Create `supabase/functions/sync/index.ts`
- [x] 1.2 Configure function for POST requests
- [x] 1.3 Implement admin API key authentication

## 2. Sync Modes
- [x] 2.1 Implement full sync mode for backfills
- [x] 2.2 Implement incremental sync mode for periodic reconciliation
- [x] 2.3 Add mode selection via request parameter

## 3. Sync Orchestration
- [x] 3.1 Parse request for `app_key` and target resources
- [x] 3.2 Look up connector for the app instance
- [x] 3.3 Call connector's sync handler with options
- [x] 3.4 Process returned entities through upsert/delete

## 4. Scheduled Functions
- [x] 4.1 Create migration for pg_cron extension (if not enabled)
- [x] 4.2 Create migration to set up scheduled jobs per app instance
- [x] 4.3 Document schedule configuration format (cron syntax)

## 5. Sync State Management
- [x] 5.1 Track last successful sync timestamp per (app_key, collection_key)
- [x] 5.2 Create `sync_state` table for tracking
- [x] 5.3 Update sync state after successful sync

## 6. Response and Logging
- [x] 6.1 Return sync results (created, updated, deleted, errors)
- [x] 6.2 Log sync operations for debugging
- [x] 6.3 Handle partial failures gracefully
