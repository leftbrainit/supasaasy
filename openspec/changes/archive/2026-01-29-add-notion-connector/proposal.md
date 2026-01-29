# Change: Add Notion Connector

## Why

Notion is a popular productivity and collaboration tool used by teams for knowledge management, project tracking, and documentation. Adding a Notion connector enables users to sync Notion data sources (databases), pages, and users into their Supabase database for analytics, AI context retrieval (RAG), and cross-app data unification.

## What Changes

- Add new `notion` connector implementation following the established connector interface
- Support syncing four resource types:
  - `data_source` - Notion data sources (the individual tables under databases)
  - `data_source_property` - Schema/properties of data sources (extracted from data source objects)
  - `page` - Pages within data sources (database rows/items)
  - `user` - Workspace users (people and bots)
- Use Notion API version `2025-09-03` (the latest version with first-class data source support)
- **UUID as ID**: Since Notion IDs are UUIDs, use them directly as the `id` column in the entities table instead of generating new UUIDs
- Support webhooks for data sources and pages (new in 2025-09-03 API version)
- Users sync via API only (no webhook support)
- Provide SQL views for common queries

## Impact

- Affected specs: `connector-interface` (no changes needed), `notion-connector` (new)
- Affected code:
  - `packages/supasaasy/src/connectors/notion/` (new connector implementation)
  - `packages/supasaasy/src/connectors/notion/migrations/` (SQL views)
  - `packages/supasaasy/src/connectors/index.ts` (register connector)
  - `config/supasaasy.config.ts` (example configuration)
