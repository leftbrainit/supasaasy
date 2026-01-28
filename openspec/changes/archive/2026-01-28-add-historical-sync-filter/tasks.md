## 1. Core Types Update

- [x] 1.1 Add `sync_from?: string | Date` to `AppConfig` interface in `types/index.ts`
- [x] 1.2 Add JSDoc comment explaining the option (ISO 8601 string or Date object)

## 2. Stripe Connector Types Update

- [x] 2.1 Add `sync_from?: string` to `StripeAppConfig` interface in `stripe/types.ts`

## 3. Stripe Connector Implementation

- [x] 3.1 Add helper function to extract `sync_from` from app config
- [x] 3.2 Update `syncCustomers` to apply `created.gte` filter when `sync_from` is set
- [x] 3.3 Update `syncProducts` to apply `created.gte` filter when `sync_from` is set
- [x] 3.4 Update `syncPrices` to apply `created.gte` filter when `sync_from` is set
- [x] 3.5 Update `syncPlans` to apply `created.gte` filter when `sync_from` is set
- [x] 3.6 Update `syncSubscriptions` to apply `created.gte` filter when `sync_from` is set
- [x] 3.7 Ensure deletion detection respects `sync_from` (only deletes records within the sync window)
- [x] 3.8 Add logging when `sync_from` is active to indicate filtered sync

## 4. Configuration Example Update

- [x] 4.1 Update `config/supasaasy.config.example.ts` with documented `sync_from` option
- [x] 4.2 Include example showing ISO 8601 date format

## 5. Validation

- [x] 5.1 Verify full sync respects `sync_from` filter via manual testing
- [x] 5.2 Verify incremental sync is unaffected by `sync_from` configuration
- [x] 5.3 Verify deletion detection does not remove records older than `sync_from`
