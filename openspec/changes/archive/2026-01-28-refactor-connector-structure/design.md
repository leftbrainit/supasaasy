## Context

SupaSaaSy is preparing to add a second connector (Intercom). The current architecture separates connector code from connector migrations:

- Code: `supabase/functions/_shared/connectors/<name>/`
- Migrations: `supabase/migrations/` (global, always applied)

This structure means:

1. All connector migrations run even if the connector isn't configured
2. Adding a connector requires changes to two separate locations
3. Connector-specific schema (views, indexes) pollutes databases that don't use that connector

## Goals / Non-Goals

**Goals:**

- Connectors are self-contained: code + migrations in one directory
- Connector migrations only apply when that connector is configured in `supasaasy.config.ts`
- Simple process for adding new connectors
- Backward compatible upgrade path for existing installations

**Non-Goals:**

- Dynamic connector loading at runtime (connectors are still compile-time determined)
- Automatic migration rollback when connectors are removed from config
- Supporting multiple versions of the same connector simultaneously

## Decisions

### Decision: Migrations live in connector directory

Each connector will have a `migrations/` subfolder containing numbered SQL files:

```
connectors/
  stripe/
    index.ts
    types.ts
    migrations/
      001_stripe_views.sql
      002_stripe_indexes.sql
```

**Rationale:** Keeps connector as a single cohesive unit. Easier to maintain, easier for contributors to understand what a connector includes.

**Alternatives considered:**

- Keep migrations in `supabase/migrations/` with naming convention (e.g., `stripe_001_views.sql`) — rejected because it still requires filtering and doesn't achieve true self-containment.
- Use Postgres schemas per connector — rejected as overly complex for the use case.

### Decision: Assembly script generates combined migration

A build-time script reads `supasaasy.config.ts`, identifies configured connectors, and concatenates their migrations into `supabase/migrations/` with appropriate sequencing.

**Rationale:** Works with existing Supabase CLI workflow (`supabase db push`). No custom migration runner needed.

**Implementation approach:**

1. Script reads config to get list of configured connector names (e.g., `['stripe']`)
2. For each connector, reads `migrations/*.sql` files in order
3. Generates a single combined file: `supabase/migrations/99999999999999_connector_migrations.sql`
4. Core schema migrations (`00000000000000_create_supasaasy_schema.sql`, etc.) remain in place

**Alternatives considered:**

- Custom migration runner — rejected as it adds complexity and diverges from Supabase patterns.
- Per-connector migration files with conditional SQL — rejected because Supabase doesn't support conditional migration execution.

### Decision: Use CREATE OR REPLACE for connector views

Connector migrations should use `CREATE OR REPLACE VIEW` and `CREATE INDEX IF NOT EXISTS` to be idempotent. This allows re-running the assembly without errors.

**Rationale:** If a user adds a connector later, or if the assembly runs again, it should not fail on already-existing objects.

## Risks / Trade-offs

**Risk: Generated migration file changes on config change**

- If a user adds/removes connectors, the generated migration file changes
- Mitigation: Generate deterministically based on connector name ordering; document that adding connectors requires re-running assembly

**Risk: Removing a connector leaves orphan schema objects**

- If a user removes a connector from config, its views/indexes remain
- Mitigation: Document this behavior; provide optional cleanup scripts per connector

**Trade-off: Assembly step adds build complexity**

- Pro: Achieves conditional migration application
- Con: Adds a script that must run before deployment
- Decision: Accept this trade-off; the script is simple and the benefit (clean databases) outweighs the cost

## Migration Plan

### For existing installations:

1. Core migrations (schema, sync_state, pg_cron) remain unchanged
2. Existing Stripe views/indexes will be recreated by the new process (idempotent)
3. No data migration needed — only schema objects are affected

### Rollback:

- Keep the original `00000000000003_add_stripe_views.sql` for one release cycle as reference
- If rollback needed, users can manually apply the original migration

## Open Questions

- **Q:** Should connector migrations support versioning for upgrades (e.g., `002_stripe_v2_views.sql`)?
  - **A:** Defer to future work; for now, connectors define current-state migrations only.

- **Q:** Should the assembly script run as a pre-deploy hook or be manual?
  - **Proposed:** Manual for now, documented in README. Can add GitHub Action step later.
