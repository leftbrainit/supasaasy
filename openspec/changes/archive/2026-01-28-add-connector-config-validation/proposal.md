# Change: Add Connector Configuration Validation

## Why

Currently, connector configuration errors (missing API keys, invalid resource types, malformed dates) are only discovered at runtime when operations fail. This leads to confusing error messages and makes debugging difficult. Early validation at startup would catch configuration issues before any operations are attempted.

## What Changes

- Add `validateConfig(appConfig: AppConfig)` method to connector interface
- Implement validation in Stripe connector for:
  - API key presence (environment variable or direct)
  - Webhook secret presence for webhook-enabled apps
  - Valid resource types in `sync_resources` array
  - Valid `sync_from` date format
- Call validation during connector initialization
- Add `ConfigurationError` with detailed field-level error messages

## Impact

- Affected specs: connector-interface
- Affected code: `connectors/index.ts`, `connectors/errors.ts`, `stripe/`
- No breaking changes - validation is additive
