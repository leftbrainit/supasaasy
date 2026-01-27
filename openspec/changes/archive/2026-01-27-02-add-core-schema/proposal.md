# Change: Add Core Database Schema

## Why
SupaSaaSy requires a canonical `entities` table to store all SaaS data in a unified format. This table design minimizes schema churn while enabling flexible querying via views. The unique constraint on `(app_key, collection_key, external_id)` is critical for idempotent sync operations.

## What Changes
- Create `supasaasy` schema
- Create canonical `entities` table with all required columns
- Add unique constraint for idempotency
- Add indexes for common query patterns
- Set up timestamp defaults and update triggers

## Impact
- Affected specs: `data-model` (new capability)
- Affected code: `supabase/migrations/`
- This is foundational—all connectors depend on this schema
