## 1. Edge Function Setup
- [x] 1.1 Create `supabase/functions/webhook/index.ts`
- [x] 1.2 Configure function to handle POST requests
- [x] 1.3 Set up CORS and security headers

## 2. Request Routing
- [x] 2.1 Extract `app_key` from URL path (`/webhook/{app_key}`)
- [x] 2.2 Look up app configuration by `app_key`
- [x] 2.3 Get appropriate connector based on provider

## 3. Webhook Processing
- [x] 3.1 Call connector's webhook verification method
- [x] 3.2 Return 401 on verification failure
- [x] 3.3 Parse webhook event using connector
- [x] 3.4 Determine event type (create, update, delete, archive)

## 4. Entity Operations
- [x] 4.1 Normalize entity data using connector
- [x] 4.2 Upsert entity for create/update events
- [x] 4.3 Delete entity for delete events
- [x] 4.4 Set `archived_at` for archive events

## 5. Response Handling
- [x] 5.1 Return 200 OK on successful processing
- [x] 5.2 Return appropriate error codes for failures
- [x] 5.3 Log webhook processing for debugging

## 6. Security
- [x] 6.1 Validate app_key exists in configuration
- [x] 6.2 Ensure secrets are loaded from Supabase secrets
- [x] 6.3 Add rate limiting awareness
