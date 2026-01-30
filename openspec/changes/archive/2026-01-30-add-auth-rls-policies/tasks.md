## 1. Core Schema Updates

- [x] 1.1 Add `AuthConfig` interface to `src/types/index.ts` with `enabled` boolean
- [x] 1.2 Update `SupaSaaSyConfig` interface to include optional `auth` field
- [x] 1.3 Update `defineConfig` to accept and validate auth configuration

## 2. Users Table and RLS SQL

- [x] 2.1 Add `USERS_TABLE_SQL` constant to `get-migrations.ts` for `supasaasy.users` table
- [x] 2.2 Add `RLS_POLICIES_SQL` constant with RLS enable statements and policies for all tables
- [x] 2.3 Ensure policies use `auth.uid() IN (SELECT user_id FROM supasaasy.users)` pattern

## 3. Migration Generation Updates

- [x] 3.1 Update `getMigrations()` to accept auth config from `SupaSaaSyConfig`
- [x] 3.2 Conditionally include users table SQL when auth is enabled
- [x] 3.3 Conditionally include RLS policies SQL when auth is enabled
- [x] 3.4 Default `auth.enabled` to `true` when not specified

## 4. Example Project Updates

- [x] 4.1 Update `examples/starter/supasaasy.config.ts` with `auth` configuration example
- [x] 4.2 Add commented example showing how to disable auth for simple deployments
- [x] 4.3 Regenerate example migration file with auth enabled

## 5. Documentation

- [x] 5.1 Add "Authentication & Authorization" section to `packages/supasaasy/README.md`
- [x] 5.2 Document the `supasaasy.users` table and how to add/remove users
- [x] 5.3 Document how to disable auth via configuration
- [x] 5.4 Add SQL examples for common user management operations
- [x] 5.5 Document that connector views inherit RLS from base entities table

## 6. Testing

- [x] 6.1 Add unit tests for auth config validation in `defineConfig`
- [x] 6.2 Add unit tests for `getMigrations()` with auth enabled/disabled
- [x] 6.3 Verify generated SQL is syntactically valid
- [x] 6.4 Manual test: verify RLS blocks unauthorized users
- [x] 6.5 Manual test: verify service_role bypasses RLS

## 7. Connector RLS Inheritance Verification

- [x] 7.1 Verify Stripe connector views inherit RLS from entities table
- [x] 7.2 Verify Intercom connector views inherit RLS from entities table
- [x] 7.3 Verify Notion connector views inherit RLS from entities table
- [x] 7.4 Document view RLS behavior in connector-specific sections if needed
