## 1. Restructure Connector Directory

- [x] 1.1 Create `migrations/` directory under `supabase/functions/_shared/connectors/stripe/`
- [x] 1.2 Move Stripe views SQL from `supabase/migrations/00000000000003_add_stripe_views.sql` to `connectors/stripe/migrations/001_views.sql`
- [x] 1.3 Ensure SQL uses idempotent statements (`CREATE OR REPLACE VIEW`, `CREATE INDEX IF NOT EXISTS`)
- [x] 1.4 Update Stripe connector to export migration metadata (list of migration files)

## 2. Create Migration Assembly Script

- [x] 2.1 Create `scripts/assemble-migrations.ts` that reads `config/supasaasy.config.ts`
- [x] 2.2 Implement connector migration discovery (scan each configured connector's `migrations/` folder)
- [x] 2.3 Generate combined migration file at `supabase/migrations/99999999999999_connector_migrations.sql`
- [x] 2.4 Add header comments indicating which connectors are included
- [x] 2.5 Test script with Stripe connector configured
- [x] 2.6 Test script with no connectors configured (should generate empty/no-op migration)

## 3. Update Deployment Workflow

- [x] 3.1 Update `.github/workflows/deploy-migrations.yml` to run assembly script before `supabase db push`
- [x] 3.2 Ensure assembly script is runnable in CI environment (Deno compatibility)
- [x] 3.3 Add step to commit generated migration file or treat as build artifact

## 4. Update Documentation

- [x] 4.1 Update README with new connector structure
- [x] 4.2 Document how to add migrations when creating a new connector
- [x] 4.3 Document the assembly process for local development

## 5. Cleanup

- [x] 5.1 Mark original `00000000000003_add_stripe_views.sql` as deprecated (add comment header)
- [ ] 5.2 Remove deprecated migration file after one release cycle (future task)
