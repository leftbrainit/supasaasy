## 1. Edge Function Setup
- [ ] 1.1 Create `supabase/functions/sync/index.ts`
- [ ] 1.2 Configure function for POST requests
- [ ] 1.3 Implement admin API key authentication

## 2. Sync Modes
- [ ] 2.1 Implement full sync mode for backfills
- [ ] 2.2 Implement incremental sync mode for periodic reconciliation
- [ ] 2.3 Add mode selection via request parameter

## 3. Sync Orchestration
- [ ] 3.1 Parse request for `app_key` and target resources
- [ ] 3.2 Look up connector for the app instance
- [ ] 3.3 Call connector's sync handler with options
- [ ] 3.4 Process returned entities through upsert/delete

## 4. Scheduled Functions
- [ ] 4.1 Create migration for pg_cron extension (if not enabled)
- [ ] 4.2 Create migration to set up scheduled jobs per app instance
- [ ] 4.3 Document schedule configuration format (cron syntax)

## 5. Sync State Management
- [ ] 5.1 Track last successful sync timestamp per (app_key, collection_key)
- [ ] 5.2 Create `sync_state` table for tracking
- [ ] 5.3 Update sync state after successful sync

## 6. Response and Logging
- [ ] 6.1 Return sync results (created, updated, deleted, errors)
- [ ] 6.2 Log sync operations for debugging
- [ ] 6.3 Handle partial failures gracefully
