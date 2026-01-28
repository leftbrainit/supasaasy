## 1. Package Structure Setup

- [x] 1.1 Create `packages/supasaasy/` directory structure
- [x] 1.2 Create root `deno.json` with workspace configuration
- [x] 1.3 Create `packages/supasaasy/deno.json` with JSR publishing config
- [x] 1.4 Create `packages/supasaasy/mod.ts` main entrypoint with exports

## 2. Library Core Migration

- [x] 2.1 Move `supabase/functions/_shared/types/` → `packages/supasaasy/src/types/`
- [x] 2.2 Move `supabase/functions/_shared/db.ts` → `packages/supasaasy/src/db/`
- [x] 2.3 Move `supabase/functions/_shared/connectors/` → `packages/supasaasy/src/connectors/`
- [x] 2.4 Update all internal imports to use relative paths within package
- [x] 2.5 Remove config.ts file-based import; add config parameter to functions

## 3. Handler Factory Functions

- [x] 3.1 Create `packages/supasaasy/src/handlers/webhook.ts` with `createWebhookHandler()`
- [x] 3.2 Create `packages/supasaasy/src/handlers/sync.ts` with `createSyncHandler()`
- [x] 3.3 Update handlers to accept config parameter instead of importing
- [x] 3.4 Export handler factories from `mod.ts`

## 4. Configuration API

- [x] 4.1 Create `packages/supasaasy/src/config/define-config.ts` with `defineConfig()` helper
- [x] 4.2 Add runtime validation to `defineConfig()`
- [x] 4.3 Export `defineConfig` and config types from `mod.ts`
- [x] 4.4 Update `getConnectorForAppKey()` to accept config parameter

## 5. Migration Generation

- [x] 5.1 Create `packages/supasaasy/src/migrations/get-migrations.ts`
- [x] 5.2 Implement core schema SQL generation
- [x] 5.3 Implement connector migration aggregation based on config
- [x] 5.4 Add version comments to generated SQL
- [x] 5.5 Export `getMigrations()` from `mod.ts`

## 6. Connector Exports

- [x] 6.1 Update `packages/supasaasy/src/connectors/stripe/index.ts` to export connector object
- [x] 6.2 Update `packages/supasaasy/src/connectors/intercom/index.ts` to export connector object
- [x] 6.3 Create connector auto-registration in main module
- [x] 6.4 Export individual connectors from `mod.ts` for tree-shaking

## 7. Example Project

- [x] 7.1 Create `examples/starter/` directory structure
- [x] 7.2 Create `examples/starter/deno.json` with local package import
- [x] 7.3 Create `examples/starter/supasaasy.config.ts` with example configuration
- [x] 7.4 Create `examples/starter/supabase/config.toml`
- [x] 7.5 Create `examples/starter/supabase/functions/webhook/index.ts` thin wrapper
- [x] 7.6 Create `examples/starter/supabase/functions/sync/index.ts` thin wrapper
- [x] 7.7 Create `examples/starter/scripts/generate-migrations.ts`
- [x] 7.8 Create `examples/starter/.env.example`
- [x] 7.9 Create `examples/starter/README.md` with local development instructions

## 8. Testing

- [x] 8.1 Test library type checking and linting
- [x] 8.2 Test migration generation
- [x] 8.3 Test webhook handler with Stripe connector
- [x] 8.4 Test sync handler with Stripe connector
- [x] 8.5 Test webhook handler with Intercom connector
- [x] 8.6 Test sync handler with Intercom connector

## 9. CI/CD and Publishing

- [x] 9.1 Create `.github/workflows/ci.yml` for package testing
- [x] 9.2 Create `.github/workflows/publish.yml` for JSR publishing on release
- [x] 9.3 Configure JSR scope and package name (`@supasaasy/core`)

## 10. Documentation

- [x] 10.1 Update root `README.md` with library installation instructions
- [x] 10.2 Add migration guide for existing scaffold users
- [x] 10.3 Document `getMigrations()` usage and workflow
- [x] 10.4 Document local development with example project

## 11. Cleanup

- [x] 11.1 Remove old `supabase/functions/_shared/` directory
- [x] 11.2 Remove old `config/supasaasy.config.ts` and `.example`
- [x] 11.3 Update `.gitignore` for new structure
- [x] 11.4 Remove old deployment workflows and scripts
