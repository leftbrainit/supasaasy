## Context

This design documents the architectural decisions for the Notion connector implementation. The connector must handle Notion's unique data model changes introduced in API version `2025-09-03`, where databases now contain data sources, and data sources contain pages.

**Key stakeholders:**
- Developers integrating Notion data into their analytics pipelines
- Users building AI/RAG applications with Notion content

**Constraints:**
- Must conform to the established connector interface
- Must use Notion API version `2025-09-03` (per project conventions requiring latest stable API)
- Notion webhooks use different signature verification than Intercom/Stripe

## Goals / Non-Goals

**Goals:**
- Sync Notion data sources, their properties/schema, pages, and users
- Support webhook-based real-time updates for data sources and pages
- Use Notion UUIDs directly as entity IDs to enable natural foreign key relationships
- Provide useful SQL views for common query patterns

**Non-Goals:**
- Syncing database objects themselves (we sync data sources, which are the actual data containers)
- Syncing blocks/content within pages (only page metadata and properties)
- Syncing comments
- Two-way sync (write-back to Notion)

## Decisions

### Decision 1: Use Notion UUIDs as Entity IDs (where available)

**What:** Store Notion's UUID identifiers directly in the `id` column of the `supasaasy.entities` table for resources that have UUID IDs (data sources, pages, users). Generate UUIDs for resources with non-UUID IDs (data source properties).

**Why:** 
- Notion uses UUIDs for data sources, pages, and users
- Enables natural foreign key relationships (e.g., page -> data_source)
- Simplifies debugging and correlation with Notion UI
- Avoids maintaining a separate ID mapping for most resources

**Exception - Data Source Properties:**
- Property IDs are short strings like `kqLW` or `wX%7Bd`, not UUIDs
- These entities will use auto-generated UUIDs for the `id` column
- The `external_id` will contain the composite key `{data_source_id}:{property_id}`

**Alternatives considered:**
- Generate new UUIDs for all resources: Rejected because it adds unnecessary indirection when most resources already have valid UUIDs
- Use property ID directly as `id`: Rejected because it's not a valid UUID format

### Decision 2: Extract Data Source Properties as Separate Entities

**What:** Store data source properties (schema) as separate `notion_data_source_property` entities, linked to their parent data source.

**Why:**
- Properties are returned as part of the data source object, not via a separate API
- Extracting them as entities enables:
  - Querying schema across all data sources
  - Tracking schema changes over time
  - Building schema-aware applications

**Alternatives considered:**
- Store properties only in `raw_payload`: Rejected because it makes cross-data-source schema queries difficult
- Create a separate view only: Rejected because it doesn't enable tracking changes

### Decision 3: Use Native Fetch for Notion API

**What:** Use Deno's native `fetch` for API calls instead of an SDK.

**Why:**
- No official Notion SDK for Deno
- Native fetch works well for REST APIs
- Consistent with Intercom connector approach
- Simpler dependency management

**Alternatives considered:**
- Port the Node.js SDK: Rejected due to complexity and maintenance burden

### Decision 4: Webhook Verification via Request Body Hash

**What:** Notion uses HMAC-SHA256 signature verification for webhooks with the secret stored in integration settings.

**Why:** This is Notion's documented approach for webhook verification.

**Implementation:**
- Verify `X-Notion-Signature` header
- Compute HMAC-SHA256 of request body using configured secret
- Compare signatures using constant-time comparison

## Risks / Trade-offs

### Risk 1: Large Data Sources

**Risk:** Notion data sources can contain thousands of pages, leading to long sync times.

**Mitigation:** 
- Use pagination with reasonable page sizes (100 items)
- Support `sync_from` configuration to limit historical sync
- Provide progress callbacks for monitoring

### Risk 2: API Rate Limits

**Risk:** Notion has relatively strict rate limits (3 requests/second per integration).

**Mitigation:**
- Implement exponential backoff on 429 responses
- Batch related operations where possible
- Log rate limit encounters for visibility

### Risk 3: Webhook Availability

**Risk:** Notion webhooks require Enterprise plan and explicit setup per integration.

**Mitigation:**
- Design connector to work with sync-only mode (no webhooks)
- Document webhook setup requirements clearly
- Support incremental sync via `last_edited_time` filtering

## Migration Plan

Not applicable - this is a new connector with no existing data to migrate.

## Open Questions

1. **Property Types:** Should we store property type-specific fields in the view (e.g., select options, formula expressions)?
   - **Resolution:** Start simple with common fields; extend based on user feedback.

2. **Page Content Sync:** Should we support syncing page blocks/content in a future iteration?
   - **Resolution:** Defer to future scope. Current focus is metadata and properties.
