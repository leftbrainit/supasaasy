# Change: Restrict CORS Configuration

## Why

Both webhook and sync handlers use `Access-Control-Allow-Origin: *` which allows any website to make requests to these endpoints. While webhooks are server-to-server and sync requires authentication, overly permissive CORS can still increase the attack surface. Since these endpoints are not intended for browser-based calls, CORS should be more restrictive.

## What Changes

- Remove wildcard CORS origin for webhook and sync endpoints
- Remove unnecessary CORS headers since these are server-to-server endpoints
- Keep minimal CORS for OPTIONS preflight only (some proxies require this)

## Impact

- Affected specs: webhook-handling, periodic-sync
- Affected code:
  - `packages/supasaasy/src/handlers/webhook.ts`
  - `packages/supasaasy/src/handlers/sync.ts`
