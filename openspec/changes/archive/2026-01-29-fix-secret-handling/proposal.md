# Change: Improve Secret Handling Security

## Why

Currently, API keys and webhook secrets can be stored directly in configuration objects (`api_key`, `webhook_secret`) as a fallback to environment variables (`api_key_env`, `webhook_secret_env`). This creates a risk of secrets being committed to version control, exposed in logs, or accessible to anyone with config file access.

While direct secrets are useful for testing, production deployments should always use environment variables.

## What Changes

- Add validation in connector config validators to warn when direct secrets are used
- Add runtime check to detect production environment and reject direct secrets
- Update error messages to guide users toward environment variable usage
- Ensure secrets are never logged, even in debug mode

## Impact

- Affected specs: connector-interface
- Affected code:
  - `packages/supasaasy/src/connectors/stripe/client.ts`
  - `packages/supasaasy/src/connectors/intercom/client.ts`
  - `packages/supasaasy/src/connectors/notion/client.ts`
  - `packages/supasaasy/src/config/define-config.ts`
