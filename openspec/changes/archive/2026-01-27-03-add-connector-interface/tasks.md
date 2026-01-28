## 1. Core Type Definitions

- [x] 1.1 Define `ConnectorMetadata` interface (name, supported resources, version)
- [x] 1.2 Define `SupportedResource` type with collection_key mapping
- [x] 1.3 Define `NormalizedEntity` type matching entities table schema

## 2. Webhook Interface

- [x] 2.1 Define `WebhookHandler` interface
- [x] 2.2 Define `WebhookVerificationResult` type
- [x] 2.3 Define `WebhookEventType` enum (create, update, delete, archive)
- [x] 2.4 Define `ParsedWebhookEvent` type

## 3. Sync Interface

- [x] 3.1 Define `SyncHandler` interface for full syncs
- [x] 3.2 Define `IncrementalSyncHandler` interface for delta syncs
- [x] 3.3 Define `SyncResult` type with success/failure counts
- [x] 3.4 Define `SyncOptions` type for pagination and filtering

## 4. Connector Registration

- [x] 4.1 Create connector registry module
- [x] 4.2 Implement `registerConnector` function
- [x] 4.3 Implement `getConnector` function by provider name
- [x] 4.4 Implement `getConnectorForAppKey` function using config lookup

## 5. Base Utilities

- [x] 5.1 Create entity normalization helper functions
- [x] 5.2 Create error types for connector failures
- [x] 5.3 Create logging utilities for connector operations
