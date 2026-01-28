# SupaSaaSy

A Supabase-native data sync framework that maintains local copies of data from external providers (Stripe, Intercom, etc.) through webhooks and periodic synchronization.

## Installation

```bash
# Using Deno
import { createWebhookHandler, createSyncHandler, defineConfig } from "jsr:@supasaasy/core";
```

Or add to your `deno.json` imports:

```json
{
  "imports": {
    "supasaasy": "jsr:@supasaasy/core@^1.0.0"
  }
}
```

## Features

- **Library-based architecture**: Install as a dependency, receive updates via version bumps
- **Webhook-driven sync**: Automatically receive and process events from external providers
- **Periodic sync**: Scheduled full/incremental syncs for data consistency
- **Multiple app instances**: Support multiple accounts per provider (e.g., multiple Stripe accounts)
- **Type-safe configuration**: TypeScript-based configuration with `defineConfig()` helper
- **Supabase-native**: Built entirely on Supabase Edge Functions and PostgreSQL

## Quick Start

### 1. Create Configuration

```typescript
// supasaasy.config.ts
import { defineConfig } from 'supasaasy';

export default defineConfig({
  apps: [
    {
      app_key: 'stripe_prod',
      name: 'Stripe Production',
      connector: 'stripe',
      config: {
        api_key_env: 'STRIPE_API_KEY',
        webhook_secret_env: 'STRIPE_WEBHOOK_SECRET',
      },
    },
  ],
  sync_schedules: [
    { app_key: 'stripe_prod', cron: '0 */6 * * *', enabled: true },
  ],
});
```

### 2. Create Edge Functions

```typescript
// supabase/functions/webhook/index.ts
import { createWebhookHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createWebhookHandler(config));
```

```typescript
// supabase/functions/sync/index.ts
import { createSyncHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createSyncHandler(config));
```

### 3. Generate and Apply Migrations

```typescript
// scripts/generate-migrations.ts
import { getMigrations } from 'supasaasy';
import config from '../supasaasy.config.ts';

const sql = await getMigrations(config);
await Deno.writeTextFile('supabase/migrations/00000000000001_supasaasy.sql', sql);
console.log('Migration file generated');
```

Run it:

```bash
deno run --allow-read --allow-write scripts/generate-migrations.ts
supabase db push --local
```

## Supported Connectors

### Stripe

| Resource           | Collection Key             | Description                    |
| ------------------ | -------------------------- | ------------------------------ |
| Customers          | `stripe_customer`          | Stripe customer objects        |
| Products           | `stripe_product`           | Stripe products                |
| Prices             | `stripe_price`             | Stripe prices                  |
| Plans              | `stripe_plan`              | Legacy Stripe plans            |
| Subscriptions      | `stripe_subscription`      | Stripe subscriptions           |
| Subscription Items | `stripe_subscription_item` | Items within subscriptions     |

### Intercom

| Resource           | Collection Key               | Description                    |
| ------------------ | ---------------------------- | ------------------------------ |
| Companies          | `intercom_company`           | Intercom companies             |
| Contacts           | `intercom_contact`           | Users and leads                |
| Admins             | `intercom_admin`             | Team members                   |
| Conversations      | `intercom_conversation`      | Conversations                  |
| Conversation Parts | `intercom_conversation_part` | Messages within conversations  |

## Configuration Options

### App Configuration

```typescript
interface AppConfig {
  app_key: string;      // Unique identifier (used in webhook URLs)
  name: string;         // Human-readable name
  connector: string;    // Connector type ('stripe' | 'intercom')
  config: {
    api_key_env?: string;        // Environment variable for API key
    webhook_secret_env?: string; // Environment variable for webhook secret
    sync_resources?: string[];   // Optional: specific resources to sync
  };
  sync_from?: string | Date;  // Optional: minimum date for historical sync
}
```

### Historical Data Filtering

Use `sync_from` to limit historical data sync:

```typescript
{
  app_key: 'stripe_prod',
  connector: 'stripe',
  config: { /* ... */ },
  // Only sync records created after this date
  sync_from: '2024-01-01T00:00:00Z',
}
```

## Manual Sync API

Trigger syncs via HTTP:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_key": "stripe_prod", "mode": "full"}'
```

### Request Parameters

| Parameter        | Type     | Required | Description                                      |
| ---------------- | -------- | -------- | ------------------------------------------------ |
| `app_key`        | string   | Yes      | The app key to sync                              |
| `mode`           | string   | No       | `full` or `incremental` (default: `incremental`) |
| `resource_types` | string[] | No       | Specific resources to sync                       |

## Querying Synced Data

```sql
-- Get all active Stripe subscriptions
SELECT * FROM supasaasy.stripe_subscriptions
WHERE status = 'active';

-- Get customer by email
SELECT * FROM supasaasy.stripe_customers
WHERE email = 'user@example.com';

-- Join customers with subscriptions
SELECT c.email, s.status, s.current_period_end
FROM supasaasy.stripe_customers c
JOIN supasaasy.stripe_subscriptions s ON s.customer_id = c.external_id;
```

## Project Structure (Library Users)

```
your-project/
├── supasaasy.config.ts           # Your configuration
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── webhook/index.ts      # Thin wrapper
│   │   └── sync/index.ts         # Thin wrapper
│   └── migrations/
│       └── 00000000000001_supasaasy.sql  # Generated
├── scripts/
│   └── generate-migrations.ts
└── deno.json
```

## Development (This Repository)

This repository is structured as a monorepo:

```
supasaasy/
├── packages/
│   └── supasaasy/              # The library (@supasaasy/core)
│       ├── src/
│       │   ├── connectors/
│       │   ├── handlers/
│       │   ├── db/
│       │   └── types/
│       ├── mod.ts              # Main entrypoint
│       └── deno.json           # JSR package config
├── examples/
│   └── starter/                # Example project
└── deno.json                   # Workspace root
```

### Running Tests

```bash
deno task test
```

### Local Development

```bash
cd examples/starter
deno task dev
deno task functions:serve
```

## Migration from Scaffold

If you were previously using the scaffold version of SupaSaaSy:

1. Install the library: Add `"supasaasy": "jsr:@supasaasy/core@^1.0.0"` to your imports
2. Create `supasaasy.config.ts` using `defineConfig()`
3. Update your Edge Functions to use `createWebhookHandler()` and `createSyncHandler()`
4. Generate migrations with `getMigrations()`
5. Remove the old `supabase/functions/_shared/` directory

See `examples/starter/` for a complete example.

## License

MIT
