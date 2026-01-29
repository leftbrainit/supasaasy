# Change: Add Webhook Logging

## Why

Users need visibility into webhook activity for debugging, auditing, and monitoring purposes. Currently, webhook requests are only logged to console output, making it difficult to trace webhook history, investigate delivery failures, or understand authorization issues.

## What Changes

- Add a `supasaasy.webhook_logs` table to store webhook request and response data
- Add configuration option to enable/disable webhook logging
- Log all webhook requests (successful, rejected, failed) with timestamps, request details, and response information
- Include authorization failures, validation errors, and processing errors in logs
- Provide efficient querying through appropriate indexes

**BREAKING**: None - this is an additive change

## Impact

- Affected specs: webhook-handling, data-model
- Affected code:
  - `packages/supasaasy/src/handlers/webhook.ts` - add logging calls
  - `packages/supasaasy/src/types/index.ts` - add logging config types
  - `examples/starter/supabase/migrations/` - add webhook_logs table migration
  - `packages/supasaasy/src/db/index.ts` - add webhook log insert helper
