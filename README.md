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
        webhook_secret_env: 'STRIPE_WEBHOOK_SECRET_STRIPE_PRODUCTION',
        api_key_env: 'STRIPE_API_KEY_STRIPE_PRODUCTION',
        sync_objects: ['customer', 'subscription', 'invoice'],
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

## Project Structure

```
supasaasy/
├── supabase/
│   ├── config.toml              # Supabase local config
│   ├── migrations/              # Database migrations
│   │   └── 00000000000000_create_supasaasy_schema.sql
│   └── functions/
│       ├── _shared/             # Shared utilities
│       │   ├── connectors/      # Connector implementations
│       │   ├── types/           # TypeScript types
│       │   ├── config.ts        # Configuration loader
│       │   └── db.ts            # Database utilities
│       ├── webhook/             # Webhook handler function
│       └── sync/                # Periodic sync function
├── config/
│   └── supasaasy.config.ts      # App configuration
├── scripts/
│   └── dev.sh                   # Local development helper
├── .github/
│   └── workflows/
│       ├── deploy-migrations.yml
│       └── deploy-functions.yml
├── .env.example
├── .env.local.example
├── deno.json
└── README.md
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

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `SUPASAASY_ADMIN_API_KEY` | Admin API key for manual sync | Yes |

Connector-specific variables follow the pattern `{PROVIDER}_{VARIABLE}_{APP_KEY}`.

## License

MIT
