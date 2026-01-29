## 1. Setup & Scaffolding

- [x] 1.1 Create connector directory structure (`packages/supasaasy/src/connectors/notion/`)
- [x] 1.2 Create type definitions (`types.ts`) for Notion API objects
- [x] 1.3 Create client module (`client.ts`) with API helpers and configuration validation
- [x] 1.4 Add Notion configuration entry to `examples/starter/supasaasy.config.ts`
- [x] 1.5 Document environment variables for API key and webhook secret

## 2. Core Implementation

- [x] 2.1 Implement normalization module (`normalization.ts`) for all resource types
- [x] 2.2 Implement ID handling to use Notion UUIDs directly as entity IDs
- [x] 2.3 Implement data source property extraction from data source objects
- [x] 2.4 Register connector in `packages/supasaasy/mod.ts`

## 3. Sync Implementation

- [x] 3.1 Implement data source sync using `/v1/search` and `/v1/data_sources/:id`
- [x] 3.2 Implement data source property extraction during data source sync
- [x] 3.3 Implement page sync using `/v1/data_sources/:id/query`
- [x] 3.4 Implement user sync using `/v1/users`
- [x] 3.5 Implement full sync orchestration (`sync/index.ts`)
- [x] 3.6 Implement incremental sync for pages using `last_edited_time` filter

## 4. Webhook Implementation

- [x] 4.1 Implement webhook signature verification using HMAC-SHA256
- [x] 4.2 Implement webhook event parsing for data source events
- [x] 4.3 Implement webhook event parsing for page events
- [x] 4.4 Implement entity extraction from webhook payloads
- [x] 4.5 Handle webhook events that require API follow-up calls (data source properties)

## 5. Views & Migrations

- [x] 5.1 Create SQL view for `supasaasy.notion_data_sources`
- [x] 5.2 Create SQL view for `supasaasy.notion_data_source_properties`
- [x] 5.3 Create SQL view for `supasaasy.notion_pages`
- [x] 5.4 Create SQL view for `supasaasy.notion_users`
- [x] 5.5 Add migration files to `migrations/001_views.sql`

## 6. Testing & Validation

- [x] 6.1 Add connector to conformance test suite
- [x] 6.2 Create test mocks for Notion API objects
- [x] 6.3 Test webhook verification and event handling
- [x] 6.4 Test entity normalization including UUID ID handling
- [x] 6.5 Test property extraction from data sources

## 7. Documentation

- [x] 7.1 Add Notion connector section to example config with documentation comments
- [x] 7.2 Document required Notion integration capabilities in config comments
- [x] 7.3 Document webhook setup requirements in config comments
