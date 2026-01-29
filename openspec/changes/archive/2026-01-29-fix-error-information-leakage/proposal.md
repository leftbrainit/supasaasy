# Change: Fix Error Information Leakage

## Why

Internal error messages are currently returned to API clients in webhook and sync error responses. This can expose implementation details, database structure, API responses, or stack traces that could aid attackers in exploiting the system.

## What Changes

- Return generic error messages to clients for 500 errors
- Log detailed error messages server-side only
- Ensure app_key and other identifiers are not logged before verification
- Standardize error response format across handlers

## Impact

- Affected specs: webhook-handling, periodic-sync
- Affected code:
  - `packages/supasaasy/src/handlers/webhook.ts`
  - `packages/supasaasy/src/handlers/sync.ts`
