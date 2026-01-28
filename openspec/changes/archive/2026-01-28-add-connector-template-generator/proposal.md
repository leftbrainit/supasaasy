# Change: Add Connector Template Generator

## Why

Creating a new connector requires understanding the full connector interface, file structure conventions, and implementation patterns. A template generator would scaffold the correct structure with placeholder implementations, reducing the learning curve and ensuring consistency across connectors.

## What Changes

- Add `scripts/new-connector.ts` generator script
- Script creates connector directory structure:
  - `index.ts` - Pre-filled with interface skeleton and registration
  - `types.ts` - Resource types, webhook event mappings, config interface
  - `client.ts` - API client template with config helpers
  - `normalization.ts` - Entity normalization template
  - `webhooks.ts` - Webhook handler template
  - `sync/index.ts` - Sync orchestration template
  - `sync/resources.ts` - Resource sync template
  - `migrations/001_views.sql` - Empty migration template
  - `__tests__/mocks.ts` - Test mock helpers
  - `__tests__/<name>.test.ts` - Test file with conformance suite
- Add `deno task new-connector <name>` command

## Impact

- Affected specs: project-setup
- Affected code: `scripts/`, `deno.json`
- No breaking changes - adds new tooling only
