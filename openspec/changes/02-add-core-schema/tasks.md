## 1. Schema Creation
- [ ] 1.1 Create migration file for `supasaasy` schema
- [ ] 1.2 Create `entities` table with all columns from PRD
- [ ] 1.3 Add unique constraint on `(app_key, collection_key, external_id)`

## 2. Indexes
- [ ] 2.1 Add index on `app_key` for filtering by app instance
- [ ] 2.2 Add index on `collection_key` for filtering by resource type
- [ ] 2.3 Add index on `external_id` for lookups
- [ ] 2.4 Add composite index on `(app_key, collection_key)` for common queries
- [ ] 2.5 Add index on `updated_at` for sync ordering

## 3. Timestamp Handling
- [ ] 3.1 Set default for `created_at` to `now()`
- [ ] 3.2 Create trigger to auto-update `updated_at` on row changes

## 4. Database Utilities
- [ ] 4.1 Create shared `db.ts` utility for Edge Functions
- [ ] 4.2 Implement upsert helper function for entities
- [ ] 4.3 Implement delete helper function for entities
