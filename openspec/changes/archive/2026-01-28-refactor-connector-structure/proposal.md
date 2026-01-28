# Change: Refactor Connector Structure

## Why

Connector logic is currently split between `supabase/functions/_shared/connectors/` (code) and `supabase/migrations/` (SQL views/indexes). As we add more connectors, all connector migrations run regardless of which connectors are configured, creating unnecessary schema objects and making connectors harder to maintain as self-contained units.

## What Changes

- Move connector-specific migrations into each connector's directory (e.g., `connectors/stripe/migrations/`)
- Create a migration assembly script that reads `supasaasy.config.ts` and generates a combined migration file containing only the migrations for configured connectors
- Update the deployment workflow to use the assembly process
- **BREAKING**: Users upgrading from existing installations will need to run a one-time migration to handle the reorganization

## Impact

- Affected specs: `connector-interface` (adds migration requirements)
- Affected code:
  - `supabase/functions/_shared/connectors/stripe/` - add migrations subfolder
  - `supabase/migrations/00000000000003_add_stripe_views.sql` - relocate to connector directory
  - `.github/workflows/deploy-migrations.yml` - update to use assembly script
  - `scripts/` - new migration assembly script
- Connector authors will need to include migrations with their connector code
