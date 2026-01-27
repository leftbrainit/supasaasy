## 1. Core Type Definitions
- [ ] 1.1 Define `ConnectorMetadata` interface (name, supported resources, version)
- [ ] 1.2 Define `SupportedResource` type with collection_key mapping
- [ ] 1.3 Define `NormalizedEntity` type matching entities table schema

## 2. Webhook Interface
- [ ] 2.1 Define `WebhookHandler` interface
- [ ] 2.2 Define `WebhookVerificationResult` type
- [ ] 2.3 Define `WebhookEventType` enum (create, update, delete, archive)
- [ ] 2.4 Define `ParsedWebhookEvent` type

## 3. Sync Interface
- [ ] 3.1 Define `SyncHandler` interface for full syncs
- [ ] 3.2 Define `IncrementalSyncHandler` interface for delta syncs
- [ ] 3.3 Define `SyncResult` type with success/failure counts
- [ ] 3.4 Define `SyncOptions` type for pagination and filtering

## 4. Connector Registration
- [ ] 4.1 Create connector registry module
- [ ] 4.2 Implement `registerConnector` function
- [ ] 4.3 Implement `getConnector` function by provider name
- [ ] 4.4 Implement `getConnectorForAppKey` function using config lookup

## 5. Base Utilities
- [ ] 5.1 Create entity normalization helper functions
- [ ] 5.2 Create error types for connector failures
- [ ] 5.3 Create logging utilities for connector operations
