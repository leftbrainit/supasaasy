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

## Authentication & Authorization

SupaSaaSy uses Postgres Row Level Security (RLS) to control access to synced data. By default, RLS is enabled and only users explicitly authorized in the `supasaasy.users` table can access data.

### How It Works

1. **RLS is enabled by default** on all SupaSaaSy tables
2. **Authorized users** are managed via the `supasaasy.users` table
3. **Service role** (Edge Functions) bypasses RLS for backend operations
4. **Connector views** (e.g., `stripe_customers`) inherit RLS from the base `entities` table

### Managing Authorized Users

Add a user to grant access:

```sql
-- Grant access to a user (use their UUID from auth.users)
INSERT INTO supasaasy.users (user_id)
VALUES ('00000000-0000-0000-0000-000000000000');
```

Remove a user to revoke access:

```sql
-- Revoke access from a user
DELETE FROM supasaasy.users
WHERE user_id = '00000000-0000-0000-0000-000000000000';
```

List all authorized users:

```sql
-- View all authorized users with their grant timestamp
SELECT user_id, created_at FROM supasaasy.users;
```

### Disabling RLS

For simpler deployments where all authenticated users should have access, disable RLS in your configuration:

```typescript
// supasaasy.config.ts
export default defineConfig({
  apps: [/* ... */],
  auth: {
    enabled: false, // Disables RLS policies
  },
});
```

When `auth.enabled` is `false`:

- No `supasaasy.users` table is created
- RLS policies are not applied
- All authenticated users can query all SupaSaaSy tables

### The supasaasy.users Table

| Column     | Type        | Description                                     |
| ---------- | ----------- | ----------------------------------------------- |
| id         | UUID        | Primary key (auto-generated)                    |
| user_id    | UUID        | References `auth.users(id)`, cascades on delete |
| created_at | TIMESTAMPTZ | When the user was granted access                |

The foreign key cascade ensures that when a user is deleted from `auth.users`, their authorization is automatically removed.

## Debug Mode

Enable detailed debug logging by setting the `SUPASAASY_DEBUG` environment variable:

```bash
# Enable debug mode
export SUPASAASY_DEBUG=true

# Run sync with debug logging
supabase functions serve sync
```

### What Gets Logged

When debug mode is enabled, you'll see detailed logs for:

- **Sync operations**: Page fetches, cursor values, entity counts, batch upserts
- **Webhook processing**: Event parsing, verification results, entity extraction
- **Database operations**: Upserts, deletes, sync state updates
- **Worker processing**: Task claims, connector selection, job completion

### Using Debug Utilities in Custom Code

You can use the debug utilities in your own connector or handler code:

```typescript
import { debugLog, isDebugEnabled } from 'supasaasy';

// Check if debug mode is enabled
if (isDebugEnabled()) {
  // Custom debug logic
}

// Log debug messages (only outputs when debug mode is enabled)
debugLog('my-component', 'Processing item', { id: '123', status: 'active' });
// Output: [2024-01-15T10:30:00.000Z] [SUPASAASY DEBUG] [my-component] Processing item { id: "123", status: "active" }
```

### Security

Debug mode is designed to be safe for production use:

- **No secrets logged**: API keys, webhook secrets, and signatures are never logged
- **No full payloads**: Raw webhook bodies are not logged to avoid sensitive data exposure
- **Disabled by default**: Debug mode is off unless explicitly enabled via environment variable

## License

MIT
