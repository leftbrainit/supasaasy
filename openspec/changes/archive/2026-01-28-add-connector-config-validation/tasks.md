## 1. Implementation

- [x] 1.1 Add optional `validateConfig` method to `Connector` interface
- [x] 1.2 Add `ConfigValidationResult` type with field-level errors
- [x] 1.3 Implement `validateStripeConfig` function in Stripe connector
- [x] 1.4 Validate API key configuration (env var exists or direct key)
- [x] 1.5 Validate webhook secret configuration
- [x] 1.6 Validate `sync_resources` contains only valid resource types
- [x] 1.7 Validate `sync_from` is a valid ISO 8601 date if provided
- [x] 1.8 Call validation in `getConnectorForAppKey` (with skipValidation option)
- [x] 1.9 Add unit tests for configuration validation
- [x] 1.10 Update error messages to be actionable
