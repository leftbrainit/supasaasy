# SupaSaaSy Starter Example

This is an example project demonstrating how to use `@supasaasy/core` as a library to sync SaaS data into Supabase.

## Quick Start

### 1. Install Dependencies

Make sure you have Deno and the Supabase CLI installed:

```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Install Supabase CLI
brew install supabase/tap/supabase
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 3. Start Supabase

```bash
deno task dev
```

### 4. Generate and Apply Migrations

```bash
# Generate the migration file based on your config
deno task generate-migrations

# Apply migrations to local database
supabase db push --local
```

### 5. Start Edge Functions

```bash
deno task functions:serve
```

### 6. Test Webhooks (Optional)

To test webhooks locally, start ngrok in a separate terminal:

```bash
deno task tunnel
```

Then configure your webhook URL in Stripe/Intercom as:
`https://<ngrok-url>/functions/v1/webhook/<app_key>`

## Project Structure

```
examples/starter/
├── supasaasy.config.ts    # Your SupaSaaSy configuration
├── supabase/
│   ├── config.toml        # Supabase local config
│   ├── functions/
│   │   ├── webhook/       # Webhook handler
│   │   │   └── index.ts
│   │   ├── sync/          # Sync handler
│   │   │   └── index.ts
│   │   ├── worker/        # Worker handler for job-based sync
│   │   │   └── index.ts
│   │   └── job-status/    # Job status query handler
│   │       └── index.ts
│   └── migrations/        # Generated migrations
│       └── 00000000000001_supasaasy.sql
├── scripts/
│   └── generate-migrations.ts
├── .env.example
└── deno.json
```

## Configuration

Edit `supasaasy.config.ts` to add your SaaS connections. See the comments in the file for examples.

### Adding a Stripe Connection

```typescript
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
});
```

### Adding an Intercom Connection

```typescript
import { defineConfig } from 'supasaasy';

export default defineConfig({
  apps: [
    {
      app_key: 'intercom_prod',
      name: 'Intercom Production',
      connector: 'intercom',
      config: {
        api_key_env: 'INTERCOM_API_KEY',
        webhook_secret_env: 'INTERCOM_WEBHOOK_SECRET',
      },
    },
  ],
});
```

## Testing

### Manual Sync

#### Job-Based Sync (Default)

For large datasets, SupaSaaSy uses job-based processing with database polling.

```bash
# 1. Start a sync job
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Authorization: Bearer your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{"app_key": "stripe_prod", "mode": "full"}'

# Response includes job_id and task info
{
  "success": true,
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "app_key": "stripe_prod",
  "mode": "full",
  "status": "pending",
  "total_tasks": 5,
  "resource_types": ["customer", "product", "price", "plan", "subscription"]
}

# 2. Start a worker to process the job
curl -X POST http://127.0.0.1:54321/functions/v1/worker \
  -H "Authorization: Bearer your-admin-api-key" \
  -d '{"job_id": "123e4567-e89b-12d3-a456-426614174000"}'

# 3. Check job status
curl -X GET "http://127.0.0.1:54321/functions/v1/job-status/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer your-admin-api-key"
```

Workers poll the database for pending tasks and process them serially. This works in both local development and production.

#### Immediate Sync (Small Datasets)

For small datasets or testing, use immediate mode for synchronous execution:

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/sync \
  -H "Authorization: Bearer your-admin-api-key" \
  -H "Content-Type: application/json" \
  -d '{"app_key": "stripe_prod", "mode": "full", "immediate": true}'
```

### Query Synced Data

```sql
-- View all synced entities
SELECT * FROM supasaasy.entities;

-- View Stripe customers (if Stripe connector is configured)
SELECT * FROM supasaasy.stripe_customers;

-- Monitor sync job progress
SELECT * FROM supasaasy.sync_jobs ORDER BY created_at DESC LIMIT 10;

-- View job tasks
SELECT * FROM supasaasy.sync_job_tasks WHERE job_id = 'your-job-id';
```

## Upgrading SupaSaaSy

When a new version of `@supasaasy/core` is released:

1. Update the import in `deno.json` to the new version
2. Re-run `deno task generate-migrations`
3. Review the updated migration file
4. Apply migrations: `supabase db push --local`
