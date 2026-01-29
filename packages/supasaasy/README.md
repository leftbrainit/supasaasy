# @supasaasy/core

> **Warning**
> This project is currently in **alpha stage** and is not ready for production use. APIs may change without notice. Use at your own risk.

A Supabase-native data sync framework that maintains local copies of data from external providers (Stripe, Intercom, Notion) through webhooks and periodic synchronization.

## Features

- **Webhook-driven sync**: Automatically receive and process events from external providers
- **Periodic sync**: Scheduled full/incremental syncs for data consistency
- **Multiple app instances**: Support multiple accounts per provider (e.g., multiple Stripe accounts)
- **Type-safe configuration**: TypeScript-based configuration with `defineConfig()` helper
- **Supabase-native**: Built entirely on Supabase Edge Functions and PostgreSQL

## Installation

```bash
deno add jsr:@supasaasy/core
```

Or add to your `deno.json` imports:

```json
{
  "imports": {
    "supasaasy": "jsr:@supasaasy/core@^1.0.0"
  }
}
```

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

```bash
deno run --allow-read --allow-write scripts/generate-migrations.ts
supabase db push --local
```

## Supported Connectors

### Stripe

| Resource           | Collection Key             |
| ------------------ | -------------------------- |
| Customers          | `stripe_customer`          |
| Products           | `stripe_product`           |
| Prices             | `stripe_price`             |
| Plans              | `stripe_plan`              |
| Subscriptions      | `stripe_subscription`      |
| Subscription Items | `stripe_subscription_item` |

### Intercom

| Resource           | Collection Key               |
| ------------------ | ---------------------------- |
| Companies          | `intercom_company`           |
| Contacts           | `intercom_contact`           |
| Admins             | `intercom_admin`             |
| Conversations      | `intercom_conversation`      |
| Conversation Parts | `intercom_conversation_part` |

### Notion

| Resource  | Collection Key    |
| --------- | ----------------- |
| Databases | `notion_database` |
| Pages     | `notion_page`     |
| Users     | `notion_user`     |

## Configuration Options

### App Configuration

```typescript
interface AppConfig {
  app_key: string; // Unique identifier (used in webhook URLs)
  name: string; // Human-readable name
  connector: string; // Connector type ('stripe' | 'intercom' | 'notion')
  config: {
    api_key_env?: string; // Environment variable for API key
    webhook_secret_env?: string; // Environment variable for webhook secret
    sync_resources?: string[]; // Optional: specific resources to sync
  };
  sync_from?: string | Date; // Optional: minimum date for historical sync
}
```

### Historical Data Filtering

Use `sync_from` to limit historical data sync:

```typescript
{
  app_key: 'stripe_prod',
  connector: 'stripe',
  config: { /* ... */ },
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

## Querying Synced Data

```sql
-- Get all active Stripe subscriptions
SELECT * FROM supasaasy.stripe_subscriptions
WHERE status = 'active';

-- Get customer by email
SELECT * FROM supasaasy.stripe_customers
WHERE email = 'user@example.com';
```

## License

MIT
