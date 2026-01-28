# Change: Add Connector Interface

## Why

SupaSaaSy needs a consistent interface that all SaaS connectors must implement. This ensures that adding new connectors doesn't require changes to core logic, and provides clear contracts for webhook handling, API syncing, and data normalization.

## What Changes

- Define TypeScript interfaces for connector metadata and capabilities
- Define webhook handler interface
- Define sync function interfaces (full and incremental)
- Define entity normalization interface
- Create base connector registration mechanism

## Impact

- Affected specs: `connector-interface` (new capability)
- Affected code: `supabase/functions/_shared/connectors/`
- All future connectors will implement this interface
