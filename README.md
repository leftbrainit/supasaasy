# SupaSaaSy

> **Warning**
> This project is currently in **alpha stage** and is not ready for production use. APIs may change without notice. Use at your own risk.

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
  webhook_logging: {
    enabled: false, // Set to true to log webhook requests to database
  },
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

| Resource           | Collection Key             | Description                |
| ------------------ | -------------------------- | -------------------------- |
| Customers          | `stripe_customer`          | Stripe customer objects    |
| Products           | `stripe_product`           | Stripe products            |
| Prices             | `stripe_price`             | Stripe prices              |
| Plans              | `stripe_plan`              | Legacy Stripe plans        |
| Subscriptions      | `stripe_subscription`      | Stripe subscriptions       |
| Subscription Items | `stripe_subscription_item` | Items within subscriptions |

### Intercom

| Resource           | Collection Key               | Description                   |
| ------------------ | ---------------------------- | ----------------------------- |
| Companies          | `intercom_company`           | Intercom companies            |
| Contacts           | `intercom_contact`           | Users and leads               |
| Admins             | `intercom_admin`             | Team members                  |
| Conversations      | `intercom_conversation`      | Conversations                 |
| Conversation Parts | `intercom_conversation_part` | Messages within conversations |

## Configuration Options

### App Configuration

```typescript
interface AppConfig {
  app_key: string; // Unique identifier (used in webhook URLs)
  name: string; // Human-readable name
  connector: string; // Connector type ('stripe' | 'intercom')
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

## Webhook Logging

SupaSaaSy can optionally log all webhook requests to the database for debugging and auditing purposes.

### Enabling Webhook Logging

```typescript
// supasaasy.config.ts
export default defineConfig({
  // ... apps configuration
  webhook_logging: {
    enabled: true, // Enable webhook logging
  },
});
```

When enabled, all webhook requests are logged to the `supasaasy.webhook_logs` table, including:

- **Request details**: HTTP method, path, headers (sensitive values redacted), and body
- **Response details**: Status code, response body, and error messages
- **Performance metrics**: Processing duration in milliseconds
- **Timestamps**: When the webhook was received

### Querying Webhook Logs

```sql
-- Get recent webhook logs
SELECT * FROM supasaasy.webhook_logs
ORDER BY created_at DESC
LIMIT 100;

-- Find failed webhooks (status >= 400)
SELECT app_key, response_status, error_message, created_at
FROM supasaasy.webhook_logs
WHERE response_status >= 400
ORDER BY created_at DESC;

-- Analyze webhook performance by app
SELECT 
  app_key,
  COUNT(*) as total_requests,
  AVG(processing_duration_ms) as avg_duration_ms,
  MAX(processing_duration_ms) as max_duration_ms
FROM supasaasy.webhook_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY app_key;
```

**Note**: Sensitive headers (Authorization, webhook signatures, etc.) are automatically redacted before storage.

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
│   │   ├── deno.json             # Import map for functions
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

## License

MIT
