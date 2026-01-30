# Change: Add Environment-Based Debug Mode

## Why

Developers using SupaSaaSy as a library need a simple way to enable detailed logging when diagnosing sync issues. Currently, the `verbose` and `dryRun` options exist in `SyncOptions` but aren't easily accessible from projects importing the library. Users must modify code to pass these options, which is cumbersome for debugging production issues.

## What Changes

- Add `SUPASAASY_DEBUG` environment variable to enable verbose logging globally
- Add debug logging to worker handler for task processing details
- Add debug logging to sync handler for job creation and execution
- Add debug logging to webhook handler for event processing
- Add debug logging to connector sync operations (API calls, entity processing)
- Add debug logging to database operations (upserts, deletes, state updates)
- Export a `isDebugEnabled()` utility function for custom debug logging
- Document debug mode usage in README

## Impact

- Affected specs: connector-interface
- Affected code:
  - `packages/supasaasy/src/connectors/utils.ts` (add debug utilities)
  - `packages/supasaasy/src/handlers/worker.ts` (add debug logging)
  - `packages/supasaasy/src/handlers/sync.ts` (add debug logging)
  - `packages/supasaasy/src/handlers/webhook.ts` (add debug logging)
  - `packages/supasaasy/src/db/index.ts` (add debug logging)
  - `packages/supasaasy/src/connectors/*/sync/*.ts` (add debug logging)
  - `packages/supasaasy/mod.ts` (export debug utilities)
