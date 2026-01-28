# Change: Add Periodic Sync Infrastructure

## Why

Webhooks alone cannot guarantee data consistency. Periodic syncs provide reconciliation to catch missed webhooks, enable backfills for initial data load, and support API version migrations. The sync schedule is configurable per app instance as specified in the PRD.

## What Changes

- Create sync Edge Function for manual and scheduled triggers
- Implement sync orchestration (full and incremental modes)
- Integrate with Supabase scheduled functions (pg_cron)
- Add admin API key protection for manual triggers
- Implement sync status tracking and logging

## Impact

- Affected specs: `periodic-sync` (new capability)
- Affected code: `supabase/functions/sync/`
- Depends on: connector-interface, core-schema
