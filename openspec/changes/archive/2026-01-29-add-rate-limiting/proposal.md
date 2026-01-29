# Change: Add Rate Limiting to Endpoints

## Why

Neither the sync nor webhook endpoints implement rate limiting, making them vulnerable to denial-of-service attacks, resource exhaustion, or API quota exhaustion on external services. Adding rate limiting protects the system from abuse and ensures fair resource usage.

## What Changes

- Add in-memory rate limiting middleware to webhook handler
- Add in-memory rate limiting middleware to sync handler
- Rate limits shall be configurable per endpoint
- Default to 100 requests per minute for webhooks, 10 requests per minute for sync
- Return 429 Too Many Requests when limit is exceeded

## Impact

- Affected specs: webhook-handling, periodic-sync
- Affected code:
  - `packages/supasaasy/src/handlers/webhook.ts`
  - `packages/supasaasy/src/handlers/sync.ts`
