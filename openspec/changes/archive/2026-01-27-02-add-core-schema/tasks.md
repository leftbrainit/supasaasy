## 1. Schema Creation
- [x] 1.1 Create migration file for `supasaasy` schema
- [x] 1.2 Create `entities` table with all columns from PRD
- [x] 1.3 Add unique constraint on `(app_key, collection_key, external_id)`

## 2. Indexes
- [x] 2.1 Add index on `app_key` for filtering by app instance
- [x] 2.2 Add index on `collection_key` for filtering by resource type
- [x] 2.3 Add index on `external_id` for lookups
- [x] 2.4 Add composite index on `(app_key, collection_key)` for common queries
- [x] 2.5 Add index on `updated_at` for sync ordering

## 3. Timestamp Handling
- [x] 3.1 Set default for `created_at` to `now()`
- [x] 3.2 Create trigger to auto-update `updated_at` on row changes

## 4. Database Utilities
- [x] 4.1 Create shared `db.ts` utility for Edge Functions
- [x] 4.2 Implement upsert helper function for entities
- [x] 4.3 Implement delete helper function for entities
