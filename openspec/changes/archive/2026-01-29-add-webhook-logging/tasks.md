## 1. Database Schema

- [x] 1.1 Add webhook_logs table migration to core schema
- [x] 1.2 Add indexes for app_key, response_status, and created_at
- [x] 1.3 Add table and column comments
- [x] 1.4 Grant appropriate permissions (authenticated: SELECT, service_role: ALL)

## 2. Type Definitions

- [x] 2.1 Add WebhookLogEntry interface to types/index.ts
- [x] 2.2 Add WebhookLoggingConfig interface for configuration
- [x] 2.3 Update SupaSaaSyConfig to include optional webhook_logging field

## 3. Database Helpers

- [x] 3.1 Add insertWebhookLog function to db/index.ts
- [x] 3.2 Implement error handling to prevent log failures from affecting webhook responses
- [x] 3.3 Add header sanitization to redact sensitive values (Authorization, X-Webhook-Signature, etc.)

## 4. Configuration

- [x] 4.1 Update defineConfig to accept webhook_logging configuration
- [x] 4.2 Add validation for webhook_logging config structure
- [x] 4.3 Default webhook_logging.enabled to false

## 5. Webhook Handler Integration

- [x] 5.1 Update createWebhookHandler to check logging configuration
- [x] 5.2 Add logging call after OPTIONS preflight handling (if enabled)
- [x] 5.3 Add logging call for method not allowed (405) responses
- [x] 5.4 Add logging call for request body size validation failures (413)
- [x] 5.5 Add logging call for rate limit rejections (429)
- [x] 5.6 Add logging call for invalid app_key format (400)
- [x] 5.7 Add logging call for unknown app_key (404)
- [x] 5.8 Add logging call for verification failures (401)
- [x] 5.9 Add logging call for connector errors (500)
- [x] 5.10 Add logging call for successful processing (200)
- [x] 5.11 Capture processing duration for performance monitoring
- [x] 5.12 Ensure logging happens asynchronously and doesn't block responses

## 6. Migration Assembly

- [x] 6.1 Update getMigrations to include webhook_logs table in core schema section
- [x] 6.2 Regenerate example migration file
- [x] 6.3 Test migration on fresh database

## 7. Documentation

- [x] 7.1 Add webhook_logging configuration to README
- [x] 7.2 Update example config files with webhook_logging option
- [x] 7.3 Document webhook_logs table schema and usage

## 8. Testing

- [ ] 8.1 Test webhook logging with enabled configuration
- [ ] 8.2 Test webhook logging with disabled configuration
- [ ] 8.3 Verify all response codes are logged correctly
- [ ] 8.4 Verify sensitive headers are redacted
- [ ] 8.5 Verify logging errors don't affect webhook processing
- [ ] 8.6 Test query performance with indexes
