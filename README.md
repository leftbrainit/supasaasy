# SupaSaaSy

A Supabase-native data sync framework that maintains local copies of data from external providers (Stripe, Shopify, etc.) through webhooks and periodic synchronization.

## Features

- **Webhook-driven sync**: Automatically receive and process events from external providers
- **Periodic sync**: Scheduled full/incremental syncs for data consistency
- **Multiple app instances**: Support multiple accounts per provider (e.g., multiple Stripe accounts)
- **Type-safe configuration**: TypeScript-based configuration with full IDE support
- **Supabase-native**: Built entirely on Supabase Edge Functions and PostgreSQL

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────────┐
│ External        │     │ Supabase                                     │
│ Providers       │     │                                              │
│ ─────────────── │     │  ┌─────────────┐    ┌────────────────────┐  │
│ • Stripe        │────▶│  │ Edge        │───▶│ PostgreSQL         │  │
│ • Shopify       │     │  │ Functions   │    │ (supasaasy schema) │  │
│ • etc.          │◀────│  │ • webhook   │    └────────────────────┘  │
│                 │     │  │ • sync      │                             │
└─────────────────┘     │  └─────────────┘                             │
                        └──────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) (v1.100.0 or later)
- [Deno](https://deno.land/) (optional, for local function development)
- [Docker](https://www.docker.com/) (required for local Supabase stack)

### Local Development Setup

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd supasaasy
   ```

2. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start the local Supabase stack**

   ```bash
   ./scripts/dev.sh start
   # Or directly: supabase start
   ```

4. **Run database migrations**

   ```bash
   supabase db push
   ```

5. **Serve Edge Functions locally**

   ```bash
   supabase functions serve
   ```

### Configuration

Edit `config/supasaasy.config.ts` to configure your app instances:

```typescript
const config: SupaSaaSyConfig = {
  apps: [
    {
      app_key: 'stripe_production',
      name: 'Stripe Production',
      connector: 'stripe',
      config: {
        api_key_env: 'STRIPE_API_KEY_STRIPE_PRODUCTION',
        webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION',
        // Optional: specify resources to sync (defaults to all)
        // sync_resources: ['customer', 'product', 'price', 'subscription'],
      },
    },
  ],
  sync_schedules: [
    {
      app_key: 'stripe_production',
      cron: '0 */6 * * *', // Every 6 hours
      enabled: true,
    },
  ],
};
```

## Stripe Connector Setup

The Stripe connector syncs the following resources from Stripe:

| Resource           | Collection Key             | Description                    |
| ------------------ | -------------------------- | ------------------------------ |
| Customers          | `stripe_customer`          | Stripe customer objects        |
| Products           | `stripe_product`           | Stripe products                |
| Prices             | `stripe_price`             | Stripe prices (replaces plans) |
| Plans              | `stripe_plan`              | Legacy Stripe plans            |
| Subscriptions      | `stripe_subscription`      | Stripe subscriptions           |
| Subscription Items | `stripe_subscription_item` | Items within subscriptions     |

### 1. Set up environment variables

```bash
# .env or .env.local
STRIPE_API_KEY_STRIPE_PRODUCTION=sk_live_...  # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION=whsec_...
```

### 2. Configure the app instance

In `config/supasaasy.config.ts`, add your Stripe configuration:

```typescript
{
  app_key: 'stripe_production',
  name: 'Stripe Production',
  connector: 'stripe',
  config: {
    api_key_env: 'STRIPE_API_KEY_STRIPE_PRODUCTION',
    webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION',
  },
}
```

### 3. Configure Stripe webhooks

In your Stripe Dashboard (Developers → Webhooks), create an endpoint with:

- **URL:** `https://<your-project>.supabase.co/functions/v1/webhook/stripe_production`
- **Events to send:**
  - `customer.created`, `customer.updated`, `customer.deleted`
  - `product.created`, `product.updated`, `product.deleted`
  - `price.created`, `price.updated`, `price.deleted`
  - `plan.created`, `plan.updated`, `plan.deleted`
  - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

### 4. Query your data

Once synced, you can query your Stripe data using the convenience views:

```sql
-- Get all active subscriptions
SELECT * FROM supasaasy.stripe_subscriptions
WHERE status = 'active';

-- Get customer by email
SELECT * FROM supasaasy.stripe_customers
WHERE email = 'user@example.com';

-- Get prices for a product
SELECT * FROM supasaasy.stripe_prices
WHERE product_id = 'prod_xxx';

-- Join customers with their subscriptions
SELECT c.email, c.name, s.status, s.current_period_end
FROM supasaasy.stripe_customers c
JOIN supasaasy.stripe_subscriptions s ON s.customer_id = c.external_id
WHERE c.app_key = 'stripe_production';
```

## Webhook Testing with ngrok

To test webhooks locally, you need to expose your local Edge Functions to the internet:

1. **Install ngrok**

   ```bash
   brew install ngrok
   # Or download from https://ngrok.com/download
   ```

2. **Start ngrok tunnel**

   ```bash
   ngrok http 54321
   ```

3. **Configure webhook URL**

   Use the ngrok URL as your webhook endpoint in the external provider's dashboard:

   ```
   https://<your-ngrok-id>.ngrok.io/functions/v1/webhook/<app_key>
   ```

4. **Alternative: Stripe CLI**

   For Stripe specifically, you can use the Stripe CLI:

   ```bash
   stripe listen --forward-to http://127.0.0.1:54321/functions/v1/webhook/stripe_production
   ```

## Manual Sync

You can manually trigger a sync using the `/sync` endpoint. This is useful for initial data imports or forcing a refresh.

### Curl Command

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -d '{"app_key": "stripe_production", "mode": "full"}'
```

### Request Body Parameters

| Parameter        | Type     | Required | Description                                                  |
| ---------------- | -------- | -------- | ------------------------------------------------------------ |
| `app_key`        | string   | Yes      | The app key to sync (e.g., `stripe_production`)              |
| `mode`           | string   | No       | `full` or `incremental` (defaults to `incremental`)          |
| `resource_types` | string[] | No       | Specific resources to sync (e.g., `["customer", "product"]`) |

### Examples

**Full sync (all resources):**

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"app_key": "stripe_production", "mode": "full"}'
```

**Incremental sync (only changes since last sync):**

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"app_key": "stripe_production", "mode": "incremental"}'
```

**Sync specific resources only:**

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -d '{"app_key": "stripe_production", "mode": "full", "resource_types": ["customer", "subscription"]}'
```

### Response

A successful sync returns a JSON response with details:

```json
{
  "success": true,
  "app_key": "stripe_production",
  "mode": "full",
  "collections": [
    {
      "collection_key": "stripe_customer",
      "created": 10,
      "updated": 5,
      "deleted": 0,
      "errors": 0,
      "error_messages": []
    }
  ],
  "total_created": 10,
  "total_updated": 5,
  "total_deleted": 0,
  "total_errors": 0,
  "duration_ms": 1234
}
```

## Project Structure

```
supasaasy/
├── supabase/
│   ├── config.toml              # Supabase local config
│   ├── migrations/              # Core database migrations
│   │   ├── 00000000000000_create_supasaasy_schema.sql
│   │   └── 99999999999999_connector_migrations.sql  # Auto-generated
│   └── functions/
│       ├── _shared/             # Shared utilities
│       │   ├── connectors/      # Connector implementations
│       │   │   └── stripe/
│       │   │       ├── index.ts
│       │   │       ├── types.ts
│       │   │       └── migrations/    # Connector-specific migrations
│       │   │           └── 001_views.sql
│       │   ├── types/           # TypeScript types
│       │   ├── config.ts        # Configuration loader
│       │   └── db.ts            # Database utilities
│       ├── webhook/             # Webhook handler function
│       └── sync/                # Periodic sync function
├── config/
│   └── supasaasy.config.ts      # App configuration
├── scripts/
│   ├── dev.sh                   # Local development helper
│   └── assemble-migrations.ts   # Connector migration assembler
├── .github/
│   └── workflows/
│       ├── deploy-migrations.yml
│       └── deploy-functions.yml
├── .env.example
├── .env.local.example
├── deno.json
└── README.md
```

## Connector Migrations

Each connector includes its own migrations in a `migrations/` subdirectory. This keeps connectors self-contained and ensures that only migrations for configured connectors are applied to your database.

### How It Works

1. Each connector has a `migrations/` folder with numbered SQL files (e.g., `001_views.sql`)
2. The assembly script reads your `supasaasy.config.ts` to identify configured connectors
3. It generates a combined migration file containing only the migrations for your connectors
4. This combined file is deployed alongside the core migrations

### Running the Assembly Script

Before deploying migrations (locally or in CI), run the assembly script:

```bash
deno run --allow-read --allow-write scripts/assemble-migrations.ts
```

This generates/updates `supabase/migrations/99999999999999_connector_migrations.sql`.

**Important:** The generated file is committed to the repository. Regenerate it whenever you:

- Add or remove connectors from your configuration
- Update connector migration files

### Adding Migrations to a Connector

When creating or modifying a connector:

1. Add SQL files to the connector's `migrations/` folder
2. Use numbered prefixes for ordering (e.g., `001_`, `002_`)
3. Use idempotent statements (`CREATE OR REPLACE`, `IF NOT EXISTS`)
4. Run the assembly script to regenerate the combined migration

Example migration structure:

```
connectors/
  myconnector/
    index.ts
    types.ts
    migrations/
      001_views.sql
      002_indexes.sql
```

## Deployment

### GitHub Actions (Recommended)

The repository includes GitHub Actions workflows for automated deployment:

1. **Set up repository secrets**

   - `SUPABASE_ACCESS_TOKEN`: Your Supabase access token
   - `SUPABASE_PROJECT_ID`: Your Supabase project ID
   - `SUPABASE_DB_PASSWORD`: Your database password

2. **Push to main branch**

   Migrations and functions will deploy automatically on push to `main`.

### Manual Deployment

```bash
# Link to your Supabase project
supabase link --project-ref <your-project-ref>

# Deploy migrations
supabase db push

# Deploy functions
supabase functions deploy webhook
supabase functions deploy sync
```

## Development

### Running Tests

```bash
deno test
```

### Linting

```bash
deno lint
```

### Formatting

```bash
deno fmt
```

## Environment Variables

### Required Variables

| Variable                    | Description                            | Required |
| --------------------------- | -------------------------------------- | -------- |
| `SUPABASE_URL`              | Supabase project URL                   | Yes      |
| `SUPABASE_ANON_KEY`         | Supabase anonymous key                 | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key              | Yes      |
| `ADMIN_API_KEY`             | Admin API key for manual sync requests | Yes      |

### Stripe Connector Variables

| Variable Pattern                  | Description            | Example                                             |
| --------------------------------- | ---------------------- | --------------------------------------------------- |
| `STRIPE_API_KEY_{APP_KEY}`        | Stripe API key         | `STRIPE_API_KEY_STRIPE_PRODUCTION=sk_live_...`      |
| `STRIPE_WEBHOOK_SECRET_{APP_KEY}` | Webhook signing secret | `STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION=whsec_...` |

Note: `{APP_KEY}` should be uppercase (e.g., `stripe_production` → `STRIPE_PRODUCTION`).

## License

MIT
