# Change: Add Webhook Infrastructure

## Why

SupaSaaSy needs a webhook endpoint to receive real-time updates from SaaS providers. The `POST /webhook/{app_key}` pattern allows multiple instances of the same provider while enabling verification before payload inspection. This is the primary low-latency ingestion path.

## What Changes

- Create webhook Edge Function with dynamic routing
- Implement app_key extraction and connector lookup
- Implement webhook verification flow
- Implement entity upsert/delete based on event type
- Add error handling and response formatting

## Impact

- Affected specs: `webhook-handling` (new capability)
- Affected code: `supabase/functions/webhook/`
- Depends on: connector-interface, core-schema
