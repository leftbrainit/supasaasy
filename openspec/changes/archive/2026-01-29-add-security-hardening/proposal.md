# Change: Add Security Hardening

## Why

Several medium-severity security issues remain:
1. Admin API key comparison uses `===` which may be vulnerable to timing attacks
2. No input validation on `app_key` format (could allow injection or path traversal)
3. No request body size limits (DoS via large payloads)

## What Changes

- Use constant-time comparison for admin API key verification
- Add input validation for `app_key` format (alphanumeric, underscore, hyphen only)
- Add request body size limits (default 1MB)

## Impact

- Affected specs: periodic-sync, webhook-handling
- Affected code:
  - `packages/supasaasy/src/handlers/sync.ts`
  - `packages/supasaasy/src/handlers/webhook.ts`
