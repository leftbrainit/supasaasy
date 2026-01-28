# Change: Add Connector Debug Mode

## Why

Currently, there's no way to test sync operations without writing to the database, no visibility into sync progress for long-running operations, and no way to enable verbose logging for specific resources. This makes debugging and development difficult, especially when implementing new connectors or troubleshooting sync issues.

## What Changes

- Add `dryRun` option to `SyncOptions` - skips database writes, logs what would happen
- Add `verbose` option to `SyncOptions` - enables detailed per-item logging
- Add `onProgress` callback to `SyncOptions` - reports sync progress for monitoring
- Add progress reporting in sync functions (resource name, items fetched, total if known)
- Update logger to respect verbose mode

## Impact

- Affected specs: connector-interface
- Affected code: `types/index.ts`, `connectors/utils.ts`, connector sync functions
- No breaking changes - all options are optional with sensible defaults
