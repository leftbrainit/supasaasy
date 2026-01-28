## 1. Connector Scaffold

- [x] 1.1 Run `deno task new-connector intercom` to generate boilerplate
- [x] 1.2 Update generated types.ts with Intercom resource types (company, contact, admin, conversation, conversation_part)
- [x] 1.3 Update generated client.ts for Intercom API patterns (Bearer auth, API version header)

## 2. Configuration

- [x] 2.1 Add `INTERCOM_API_KEY_SANDBOX` to `.env.local`
- [x] 2.2 Add `INTERCOM_WEBHOOK_SECRET_SANDBOX` to `.env.local`
- [x] 2.3 Add `intercom_sandbox` app instance to `config/supasaasy.config.ts`

## 3. API Client Implementation

- [x] 3.1 Implement `createIntercomClient()` function with Bearer token auth
- [x] 3.2 Implement paginated list functions for each resource type
- [x] 3.3 Implement conversation search for incremental sync

## 4. Webhook Implementation

- [x] 4.1 Implement HMAC SHA-1 signature verification in webhooks.ts
- [x] 4.2 Map Intercom webhook event types to internal event types
- [x] 4.3 Implement entity extraction for supported webhook topics

## 5. Normalization

- [x] 5.1 Implement `normalizeIntercomEntity()` for all resource types
- [x] 5.2 Implement archived state detection (conversation closed state)
- [x] 5.3 Handle conversation part extraction from conversation payloads

## 6. Sync Implementation

- [x] 6.1 Implement company sync (full and incremental)
- [x] 6.2 Implement contact sync (full and incremental)
- [x] 6.3 Implement admin sync (full only, no webhooks)
- [x] 6.4 Implement conversation sync with conversation_parts extraction
- [x] 6.5 Implement sync_from filtering for historical data limits

## 7. Database Views

- [x] 7.1 Create `intercom_companies` view in migrations/001_views.sql
- [x] 7.2 Create `intercom_contacts` view
- [x] 7.3 Create `intercom_admins` view
- [x] 7.4 Create `intercom_conversations` view
- [x] 7.5 Create `intercom_conversation_parts` view

## 8. Testing

- [x] 8.1 Update test mocks with Intercom-specific mock data generators
- [x] 8.2 Add unit tests for normalization functions
- [x] 8.3 Add unit tests for webhook verification
- [x] 8.4 Run conformance tests

## 9. Sandbox Data Population

- [x] 9.1 Create test companies in Intercom sandbox (4 companies synced)
- [x] 9.2 Create test contacts in Intercom sandbox (4 contacts synced)
- [x] 9.3 Create test conversations in Intercom sandbox (1 conversation synced)
- [x] 9.4 Verify sync retrieves expected data

## 10. Integration Validation

- [x] 10.1 Run full sync for all resource types
- [x] 10.2 Verify database views return expected data
- [x] 10.3 Test webhook handling with ngrok tunnel (contact.user.updated webhook processed successfully)
- [ ] 10.4 Verify incremental sync works correctly
