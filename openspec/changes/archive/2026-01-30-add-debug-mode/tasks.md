# Tasks: Add Environment-Based Debug Mode

## 1. Core Debug Infrastructure

- [x] 1.1 Add `isDebugEnabled()` function to `connectors/utils.ts` that checks `SUPASAASY_DEBUG` env var
- [x] 1.2 Add `debugLog()` helper function that only logs when debug mode is enabled
- [x] 1.3 Export debug utilities from `mod.ts`

## 2. Handler Debug Logging

- [x] 2.1 Add debug logging to `handlers/worker.ts`:
  - Log task claim attempts and results
  - Log sync options being used
  - Log connector selection
  - Log task completion details
- [x] 2.2 Add debug logging to `handlers/sync.ts`:
  - Log job creation details
  - Log resource type selection
  - Log sync mode determination
- [x] 2.3 Add debug logging to `handlers/webhook.ts`:
  - Log incoming webhook details (redacted)
  - Log verification results
  - Log entity extraction results
  - Log database operation results

## 3. Database Operation Debug Logging

- [x] 3.1 Add debug logging to `db/index.ts`:
  - Log entity upsert operations (count, collection keys)
  - Log entity delete operations
  - Log sync state updates
  - Log job and task status updates

## 4. Connector Sync Debug Logging

- [x] 4.1 Add debug logging to `paginatedSync()` utility:
  - Log each page fetch (page number, cursor, item count)
  - Log entity normalization (when verbose)
  - Log batch upsert results
  - Log deletion detection results
- [x] 4.2 Add debug logging to Stripe connector sync operations (via paginatedSync)
- [x] 4.3 Add debug logging to Intercom connector sync operations (via paginatedSync)
- [x] 4.4 Add debug logging to Notion connector sync operations (via paginatedSync)

## 5. Documentation

- [x] 5.1 Update README with debug mode documentation
- [x] 5.2 Add inline code comments explaining debug log points

## 6. Testing

- [x] 6.1 Test debug mode enabled via environment variable
- [x] 6.2 Test debug mode disabled by default
- [x] 6.3 Verify sensitive data is not logged (API keys, secrets, webhook payloads)
