# Change: Add Intercom Connector

## Why

SupaSaaSy Phase 2 requires an Intercom connector to validate the multi-connector architecture. Intercom provides customer messaging and support features, with data about companies, contacts, admins, and conversations that is valuable for analytics and AI use cases.

## What Changes

- Add new Intercom connector following existing connector patterns
- Support Company, Contact, Admin, Conversation, and Conversation Part resources
- Implement webhook verification using HMAC SHA-1 with `X-Hub-Signature` header
- Use Intercom REST API v2.14 for sync operations
- Create database views for common Intercom entity queries
- Add `intercom_sandbox` configuration entry
- Populate sandbox instance with test data for development

## Impact

- Affected specs: connector-interface, new intercom-connector spec
- Affected code:
  - `supabase/functions/_shared/connectors/intercom/` (new connector)
  - `config/supasaasy.config.ts` (new app instance)
  - `.env.local` (new environment variables)
  - `supabase/migrations/` (connector views via assembly)

## Dependencies

- Existing connector interface (no changes required to core)
- Intercom API key and webhook secret for sandbox instance
- `deno task new-connector` template generator
