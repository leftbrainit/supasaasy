## Context

This is Phase 2 of SupaSaaSy, validating that the connector architecture supports multiple providers. The Intercom connector follows the established patterns from the Stripe connector while adapting to Intercom-specific API patterns.

### Key Differences from Stripe

1. **No official SDK**: Intercom doesn't have a Deno SDK, so we'll use direct HTTP API calls
2. **Webhook verification**: Uses HMAC SHA-1 with `X-Hub-Signature` header (not Stripe-Signature)
3. **API authentication**: Bearer token in Authorization header (not stripe-specific header)
4. **Pagination**: Cursor-based using `starting_after` parameter
5. **Resource structure**: Conversations contain nested conversation_parts

## Goals / Non-Goals

### Goals
- Sync Company, Contact, Admin, Conversation, and Conversation Part resources
- Support webhook-based real-time updates
- Support full and incremental API sync
- Create useful database views for common queries
- Handle nested data (conversation parts within conversations)

### Non-Goals
- Two-way sync / write-back to Intercom
- Syncing all Intercom resources (Articles, Help Center, etc.)
- Real-time conversation part extraction from webhooks (will sync via API)

## Decisions

### Decision: Use native fetch for API calls
- **Rationale**: No official Intercom Deno SDK available; fetch is sufficient for REST APIs
- **Alternative**: Could create a thin wrapper, but adds complexity without benefit

### Decision: Store Conversation Parts as separate entities
- **Rationale**: Parts have their own IDs and can be queried independently
- **Alternative**: Store embedded in conversation raw_payload (loses queryability)

### Decision: Sync Admins without webhooks
- **Rationale**: Intercom doesn't provide admin webhooks; admins change rarely
- **Alternative**: Skip admin sync (loses useful data for conversation assignment context)

### Decision: Use client_secret for webhook verification
- **Rationale**: Intercom signs webhooks using the app's client_secret (not a separate webhook secret)
- **Environment variable**: `INTERCOM_WEBHOOK_SECRET_*` will store the client_secret value

### Decision: Use conversation search for incremental sync
- **Rationale**: Intercom's `/conversations/search` endpoint supports filtering by `updated_at`
- **Alternative**: List all conversations and filter client-side (inefficient)

## Risks / Trade-offs

- **Conversation Parts volume**: Large conversations can have 500+ parts; sync may be slow
  - Mitigation: Batch upserts, progress callbacks
- **Rate limits**: Intercom has rate limits (varies by plan)
  - Mitigation: Respect retry-after headers, use existing connector error handling
- **Webhook coverage**: Not all resources have webhooks (e.g., Admin)
  - Mitigation: Rely on periodic sync for complete coverage

## Migration Plan

No database migrations needed for core schema (uses existing supasaasy.entities table). Connector-specific views will be added via the migration assembly process.

## Open Questions

None - the Intercom API is well-documented and the connector interface is proven.
