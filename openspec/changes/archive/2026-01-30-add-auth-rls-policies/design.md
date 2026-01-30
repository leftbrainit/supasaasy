## Context

SupaSaaSy syncs data from SaaS providers into Supabase Postgres tables. Currently, all tables grant `SELECT` to `authenticated` role without RLS, meaning any authenticated user can read all synced data. This is problematic for multi-user applications where different users should have different access levels.

Supabase Auth provides the authentication layer via `auth.users`. This change adds an authorization layer using Postgres Row Level Security (RLS) policies that reference a new `supasaasy.users` table.

**Stakeholders:**

- Library consumers who need to control access to synced data
- Downstream applications that query SupaSaaSy tables

**Constraints:**

- Must work with existing Supabase Auth system
- Must not break `service_role` access for backend operations
- Must be backwards-compatible (existing users can disable RLS)
- Connector views inherit RLS from base `entities` table

## Goals / Non-Goals

**Goals:**

- Enable RLS on all supasaasy schema tables by default
- Provide a `supasaasy.users` table to manage authorized users
- Allow library consumers to easily add/remove authorized users
- Generate RLS policies via `getMigrations()`
- Support disabling RLS via configuration for simpler deployments
- Clear documentation for auth setup

**Non-Goals:**

- Per-entity or per-app_key access control (future scope)
- Role-based access control (admin vs read-only) (future scope)
- Integration with external identity providers beyond Supabase Auth
- User management UI

## Decisions

### Decision 1: Use a dedicated `supasaasy.users` table

**Why:** A dedicated table provides explicit control over who can access SupaSaaSy data without coupling to the application's user model. It allows:

- Separate management of SupaSaaSy access from general app users
- Simple boolean membership check in RLS policies
- No assumptions about the app's user schema

**Alternatives considered:**

1. **Use `auth.users` directly** - Would give all authenticated users access, which may be too permissive
2. **Use a custom claim/role in JWT** - More complex setup, requires auth hook configuration
3. **Per-app_key access table** - More granular but adds complexity; can be added later

### Decision 2: RLS policies use `IN (SELECT user_id FROM supasaasy.users)`

**Why:** This pattern:

- Is simple to understand and audit
- Performs well with an index on `user_id`
- Works consistently across all tables
- Easy to test (add/remove from users table)

**Policy pattern:**

```sql
CREATE POLICY "Allow authorized users to SELECT"
  ON supasaasy.entities
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM supasaasy.users));
```

### Decision 3: Service role bypasses RLS

**Why:** Edge Functions use `service_role` for backend operations (webhook processing, sync). Service role must have unrestricted access. Postgres RLS is bypassed by default for superuser/service roles.

### Decision 4: RLS enabled by default, configurable via config

**Why:** Security-by-default is the safer approach. Users who want simpler deployments can explicitly disable RLS:

```typescript
export default defineConfig({
  apps: [...],
  auth: {
    enabled: false, // Disables RLS policy generation
  },
});
```

When `auth.enabled: false`:

- RLS policies are not generated
- Tables remain accessible to all `authenticated` users (current behavior)

### Decision 5: Views inherit RLS from base tables

**Why:** Connector views (e.g., `stripe_customers_view`) are built on `supasaasy.entities`. When RLS is enabled on `entities`, view access is automatically restricted. No additional policies needed on views.

PostgreSQL's `SECURITY INVOKER` (default for views) ensures the view runs with the permissions of the calling user, inheriting RLS from the underlying table.

## Risks / Trade-offs

| Risk                                         | Mitigation                                                           |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Breaking change for existing users           | Document clearly; provide `auth.enabled: false` escape hatch         |
| Performance impact of RLS policy checks      | Index on `supasaasy.users.user_id`; policy uses simple IN subquery   |
| Users forget to add users to the table       | Clear error message when authenticated user has no access            |
| Complex multi-tenant scenarios not supported | Document as out-of-scope; can extend later with per-app_key policies |

## Migration Plan

1. **New deployments:** RLS enabled by default, users must add entries to `supasaasy.users`
2. **Existing deployments upgrading:**
   - Must regenerate and apply migrations
   - Can set `auth.enabled: false` to maintain current behavior
   - Or add their users to `supasaasy.users` table after migration

**Rollback:** Remove RLS with:

```sql
ALTER TABLE supasaasy.entities DISABLE ROW LEVEL SECURITY;
-- Repeat for other tables
```

## Open Questions

1. **Should we support read-only vs admin roles?** Deferred to future scope. Current implementation is binary: either full access or no access.

2. **Should webhook_logs be accessible to authenticated users?** Current design: yes, if user is in `supasaasy.users`. Rationale: logs may be useful for debugging in dashboards.

3. **Should sync_jobs/sync_job_tasks be accessible?** Yes, for job status monitoring. Users should be able to check sync progress.
