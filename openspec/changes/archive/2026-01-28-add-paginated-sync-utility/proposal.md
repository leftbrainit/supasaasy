# Change: Add Paginated Sync Utility

## Why

Each resource sync function (customers, products, prices, plans, subscriptions) repeats nearly identical pagination, timer tracking, error handling, and deletion detection logic. This violates DRY, makes connectors error-prone to implement, and increases the maintenance burden. A generic pagination helper would reduce each resource sync to ~20 lines instead of 80+.

## What Changes

- Add `paginatedSync<T>()` utility function to `connectors/utils.ts`
- The utility handles:
  - Cursor-based pagination loop
  - Timer tracking and result aggregation
  - Error handling with consistent error messages
  - Deletion detection for full syncs
  - Batch upserts to database
- Refactor Stripe connector sync functions to use the utility
- Document the utility for new connector authors

## Impact

- Affected specs: connector-interface
- Affected code: `supabase/functions/_shared/connectors/utils.ts`, `stripe/sync/`
- Reduces code duplication by ~300 lines in Stripe connector
- Makes new connector implementation significantly easier
