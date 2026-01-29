## 1. Implementation

- [x] 1.1 Add `isProductionEnvironment()` helper function to detect production
- [x] 1.2 Update `getApiKey` functions in all connectors to warn when using direct secrets
- [x] 1.3 Update `getWebhookSecret` functions in all connectors to warn when using direct secrets
- [x] 1.4 Add validation check in `validateConfig` methods to flag direct secret usage
- [x] 1.5 Ensure debug logging never includes secret values (sanitize any sensitive fields)

## 2. Testing

- [x] 2.1 Verify tests still work with direct secrets in test environment
- [x] 2.2 Verify warnings are emitted when direct secrets are used
