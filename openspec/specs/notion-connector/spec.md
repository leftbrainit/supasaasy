# notion-connector Specification

## Purpose

TBD - created by archiving change add-notion-connector. Update Purpose after archive.

## Requirements

### Requirement: Notion Connector Registration

The Notion connector SHALL be registered with the connector registry.

#### Scenario: Connector available by provider name

- **WHEN** `getConnector("notion")` is called
- **THEN** the Notion connector SHALL be returned

#### Scenario: Metadata includes supported resources

- **WHEN** the Notion connector metadata is queried
- **THEN** it SHALL list: data_source, data_source_property, page, user

#### Scenario: Metadata includes API version

- **WHEN** the Notion connector metadata is queried
- **THEN** it SHALL specify API version "2025-09-03"

### Requirement: Notion UUID as Entity ID

The Notion connector SHALL use Notion's native UUIDs as the primary identifier for resources that have UUID IDs.

#### Scenario: Notion UUID used for data sources, pages, and users

- **WHEN** a data source, page, or user entity is normalized
- **THEN** the entity `id` SHALL be set to the Notion object's UUID
- **AND** the `external_id` SHALL also contain the same UUID

#### Scenario: UUID format preserved

- **WHEN** a data source, page, or user entity is stored
- **THEN** the UUID format (e.g., "2f26ee68-df30-4251-aad4-8ddc420cba3d") SHALL be preserved exactly

#### Scenario: Generated UUID for data source properties

- **WHEN** a data source property entity is normalized
- **THEN** the entity `id` SHALL be a generated UUID (not derived from Notion)
- **AND** the `external_id` SHALL contain the composite key `{data_source_id}:{property_id}`

### Requirement: Notion Webhook Verification

The Notion connector SHALL verify webhook signatures using HMAC-SHA256.

#### Scenario: Valid Notion signature accepted

- **WHEN** a webhook with valid `X-Notion-Signature` header is received
- **THEN** verification SHALL pass
- **AND** the event SHALL be processed

#### Scenario: Invalid signature rejected

- **WHEN** a webhook with invalid or missing `X-Notion-Signature` header is received
- **THEN** verification SHALL fail
- **AND** 401 Unauthorized SHALL be returned

#### Scenario: Signature computed with webhook secret

- **WHEN** verifying a webhook signature
- **THEN** the connector SHALL compute HMAC-SHA256 of the request body
- **AND** use the configured webhook secret as the key
- **AND** compare against the signature in the header

### Requirement: Notion Data Source Sync

The Notion connector SHALL sync Data Source resources.

#### Scenario: Data source discovered via search

- **WHEN** a full sync is performed for data sources
- **THEN** data sources SHALL be discovered via the Search API with `filter: { value: "data_source" }`
- **AND** full data source details SHALL be fetched via `/v1/data_sources/:id`

#### Scenario: Data source created via webhook

- **WHEN** a `data_source.created` webhook is received
- **THEN** an entity SHALL be inserted with `collection_key: "notion_data_source"`

#### Scenario: Data source updated via webhook

- **WHEN** a `data_source.schema_updated` or `data_source.content_updated` webhook is received
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Data source deleted via webhook

- **WHEN** a `data_source.deleted` webhook is received
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Data source undeleted via webhook

- **WHEN** a `data_source.undeleted` webhook is received
- **THEN** `archived_at` SHALL be cleared on the entity

#### Scenario: Data source archived state detected

- **WHEN** a data source has `archived: true` or `in_trash: true`
- **THEN** `archived_at` SHALL be set on the entity

### Requirement: Notion Data Source Property Sync

The Notion connector SHALL extract and sync Data Source Property resources from data sources.

#### Scenario: Properties extracted from data source

- **WHEN** a data source is synced (webhook or API)
- **THEN** properties SHALL be extracted from the `properties` object
- **AND** each property SHALL be stored with `collection_key: "notion_data_source_property"`

#### Scenario: Property external ID format

- **WHEN** a data source property is normalized
- **THEN** the `external_id` SHALL be formatted as `{data_source_id}:{property_id}`
- **AND** the `id` SHALL be a generated UUID (since property IDs are not UUIDs)

#### Scenario: Property includes data source reference

- **WHEN** a data source property is stored
- **THEN** the data source ID SHALL be accessible via `raw_payload.data_source_id`

#### Scenario: Property metadata preserved

- **WHEN** a data source property is stored
- **THEN** `raw_payload` SHALL include the property name, type, and type-specific configuration

### Requirement: Notion Page Sync

The Notion connector SHALL sync Page resources.

#### Scenario: Pages fetched via data source query

- **WHEN** a full sync is performed for pages
- **THEN** pages SHALL be fetched via `/v1/data_sources/:id/query` for each data source
- **AND** pagination SHALL be handled using cursor-based pagination

#### Scenario: Page created via webhook

- **WHEN** a `page.created` webhook is received with a data source parent
- **THEN** an entity SHALL be inserted with `collection_key: "notion_page"`

#### Scenario: Page updated via webhook

- **WHEN** a `page.properties_updated` or `page.content_updated` webhook is received
- **THEN** the entity SHALL be upserted with updated `raw_payload`

#### Scenario: Page deleted via webhook

- **WHEN** a `page.deleted` webhook is received
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Page undeleted via webhook

- **WHEN** a `page.undeleted` webhook is received
- **THEN** `archived_at` SHALL be cleared on the entity

#### Scenario: Page archived state detected

- **WHEN** a page has `archived: true` or `in_trash: true`
- **THEN** `archived_at` SHALL be set on the entity

#### Scenario: Page incremental sync available

- **WHEN** an incremental sync is performed for pages
- **THEN** only pages with `last_edited_time` after the last sync timestamp SHALL be fetched

### Requirement: Notion User Sync

The Notion connector SHALL sync User resources.

#### Scenario: Users fetched via list endpoint

- **WHEN** a full sync is performed for users
- **THEN** users SHALL be fetched via `/v1/users`
- **AND** pagination SHALL be handled using cursor-based pagination

#### Scenario: User no webhook support

- **WHEN** the connector metadata is queried for user resources
- **THEN** `supportsWebhooks` SHALL be false for user resources

#### Scenario: User type preserved

- **WHEN** a user is synced
- **THEN** the user type (person or bot) SHALL be accessible via `raw_payload.type`

### Requirement: Notion Views

The connector SHALL provide database views for common queries.

#### Scenario: Data sources view available

- **WHEN** querying `supasaasy.notion_data_sources`
- **THEN** the view SHALL return id, external_id, title, parent_database_id, archived, in_trash, created_at, updated_at

#### Scenario: Data source properties view available

- **WHEN** querying `supasaasy.notion_data_source_properties`
- **THEN** the view SHALL return id, external_id, data_source_id, property_id, name, type

#### Scenario: Pages view available

- **WHEN** querying `supasaasy.notion_pages`
- **THEN** the view SHALL return id, external_id, data_source_id, title, archived, in_trash, created_at, updated_at, created_by_id, last_edited_by_id

#### Scenario: Users view available

- **WHEN** querying `supasaasy.notion_users`
- **THEN** the view SHALL return id, external_id, name, avatar_url, type, email (for persons)

### Requirement: Notion API Client

The connector SHALL use native fetch for Notion API calls.

#### Scenario: Bearer token authentication

- **WHEN** making API requests to Notion
- **THEN** the connector SHALL include `Authorization: Bearer {api_key}` header

#### Scenario: API version header

- **WHEN** making API requests to Notion
- **THEN** the connector SHALL include `Notion-Version: 2025-09-03` header

#### Scenario: API version tracked in entities

- **WHEN** entities are synced
- **THEN** `api_version` SHALL be set to "2025-09-03"

### Requirement: Notion Configuration

The connector SHALL be configurable via app instance settings.

#### Scenario: API key from environment

- **WHEN** the connector initializes
- **THEN** the Notion API key (Internal Integration Token) SHALL be loaded from environment variables

#### Scenario: Multiple instances supported

- **WHEN** multiple Notion instances are configured (e.g., `notion_sandbox`, `notion_production`)
- **THEN** each SHALL have its own API key and webhook secret

#### Scenario: sync_from limits historical data

- **WHEN** a Notion app instance has `sync_from` configured
- **THEN** full sync SHALL filter records by creation timestamp
- **AND** only records created on or after the timestamp SHALL be synced

#### Scenario: sync_resources configuration

- **WHEN** `sync_resources` is configured
- **THEN** only the specified resource types SHALL be synced
- **AND** valid values are: data_source, data_source_property, page, user

### Requirement: Notion Rate Limit Handling

The connector SHALL handle Notion API rate limits gracefully.

#### Scenario: Rate limit retry with backoff

- **WHEN** a 429 (Rate Limited) response is received
- **THEN** the connector SHALL retry with exponential backoff
- **AND** the `Retry-After` header SHALL be respected if present

#### Scenario: Rate limit logged

- **WHEN** a rate limit is encountered
- **THEN** the connector SHALL log the rate limit for visibility
