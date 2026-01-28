# Change: Refactor Connector File Structure

## Why

The Stripe connector's `index.ts` file is 1,300+ lines containing constants, helpers, normalization, webhooks, and all sync functions. This monolithic structure makes it difficult to navigate, understand for new connector authors, test individual pieces in isolation, and debug specific functionality.

## What Changes

- Split `index.ts` into logical modules:
  - `client.ts` - API client creation and configuration helpers
  - `normalization.ts` - Entity normalization and archived state detection
  - `webhooks.ts` - Webhook verification, parsing, and entity extraction
  - `sync/index.ts` - Full and incremental sync orchestration
  - `sync/resources.ts` - Resource-specific sync configurations
  - `index.ts` - Exports, registration, and connector object only
- Update imports throughout the codebase
- Ensure all existing tests continue to pass

## Impact

- Affected specs: connector-interface
- Affected code: `supabase/functions/_shared/connectors/stripe/`
- No breaking changes to public API
