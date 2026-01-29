# Change: Remove Unused Raw SQL Query Function

## Why

The `query()` function in `db/index.ts` accepts raw SQL strings and passes them to an RPC function `exec_sql`. While currently unused, this function poses a significant SQL injection risk if ever used with user-controlled input. Since all current database operations use Supabase's parameterized query builder, this function is unnecessary and should be removed to reduce the attack surface.

## What Changes

- Remove the unused `query()` function from `db/index.ts`
- This is a safe removal as the function has no callers

## Impact

- Affected specs: data-model
- Affected code: `packages/supasaasy/src/db/index.ts`
