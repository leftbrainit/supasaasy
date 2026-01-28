# Change: Add Historical Sync Filter Configuration

## Why

SaaS connectors like Stripe can contain large amounts of historical data spanning many years. For new deployments, syncing the entire history is often unnecessary and can significantly increase initial setup time and database storage costs. Users need a way to limit historical data sync to a specific starting point.

## What Changes

- Add optional `sync_from` configuration option to the app config interface
- Update connector interface to use `sync_from` as a floor timestamp during full sync operations
- Update Stripe connector to respect the `sync_from` configuration when performing full sync
- When `sync_from` is configured, full sync SHALL only fetch records created on or after that timestamp
- Incremental sync behavior remains unchanged (uses last sync timestamp)
- Deletion detection during full sync SHALL be scoped to records created on or after `sync_from`

## Impact

- Affected specs: `connector-interface`, `stripe-connector`
- Affected code:
  - `supabase/functions/_shared/types/index.ts` - Add `sync_from` to `AppConfig`
  - `supabase/functions/_shared/connectors/stripe/types.ts` - Add `sync_from` to `StripeAppConfig`
  - `supabase/functions/_shared/connectors/stripe/index.ts` - Apply `sync_from` filter in full sync
  - `config/supasaasy.config.example.ts` - Document `sync_from` option
