# Change: Add Supabase Auth and RLS Policies

## Why

The SupaSaaSy schema tables (`entities`, `sync_state`, `webhook_logs`, `sync_jobs`, `sync_job_tasks`) are currently accessible to any authenticated user without authorization checks. While `service_role` has full access for backend operations, there's no mechanism to control which users can view or manage synced data. Adding Row Level Security (RLS) policies provides fine-grained access control, ensuring only authorized users can access SupaSaaSy data.

## What Changes

- Add `supasaasy.users` table to manage authorized users (links to `auth.users`)
- Enable RLS on all existing supasaasy schema tables and views
- Create RLS policies that restrict access to users listed in `supasaasy.users`
- Update `getMigrations` to include RLS policy SQL in generated migrations
- Add configuration option for enabling/disabling RLS policies
- Update README with setup instructions for auth integration
- Update example project with auth setup demonstration

## Impact

- Affected specs: `data-model`
- Affected code:
  - `packages/supasaasy/src/migrations/get-migrations.ts`: Add RLS policy generation
  - `packages/supasaasy/src/types/index.ts`: Add auth configuration types
  - `packages/supasaasy/README.md`: Add auth setup documentation
  - `examples/starter/supasaasy.config.ts`: Add auth configuration example
  - Connector migration files: Add RLS to connector-specific views

- **BREAKING**: Tables will have RLS enabled by default. Users must either:
  1. Add authorized users to `supasaasy.users` table, or
  2. Set `auth.enabled: false` in config to disable RLS policies
