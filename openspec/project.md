# Project Context

## Purpose

SupaSaaSy is an open-source framework that synchronizes data from popular SaaS business applications into a Supabase (Postgres) database. It supports both low-latency ingestion via webhooks and configurable periodic synchronization via APIs, enabling businesses to maintain an up-to-date, unified data layer across their tools.

**Goals:**

- Provide a reliable, self-hosted data sync layer from SaaS apps into Supabase
- Support realtime updates via webhooks with eventual consistency via periodic syncs
- Offer a consistent connector interface for multiple SaaS applications
- Minimize schema churn through a single canonical `entities` table
- Enable downstream use cases: cross-app analytics, dashboards, automation, AI context retrieval (RAG)
- Be easy to run locally and deploy via Supabase + GitHub Actions

## Tech Stack

- **Database:** Supabase (Postgres)
- **Runtime:** Deno (Supabase Edge Functions)
- **Language:** TypeScript
- **CI/CD:** GitHub Actions
- **Local Development:** Supabase CLI, optional ngrok for webhook testing
- **SaaS SDKs:** Official provider SDKs where available (e.g., Stripe SDK)

## Project Conventions

### Code Style

- TypeScript strict mode
- **Always use the absolute latest stable versions** of all packages, SDKs, and APIs—no pinning to older versions unless there is a documented compatibility issue
- Prefer official SaaS provider SDKs over raw HTTP calls
- Configuration via single config file + environment variables
- User-defined `app_key` identifiers for SaaS instances (e.g., `stripe_main`, `stripe_eu`)
- Resource types use `collection_key` naming (e.g., `stripe_customer`, `stripe_subscription`)

### Architecture Patterns

- **Single Canonical Table:** All SaaS data stored in `supasaasy.entities` table with JSONB `raw_payload`
- **Connector Interface:** Each SaaS connector conforms to a shared interface:
  - Define supported resources
  - Verify webhooks
  - Fetch data via APIs
  - Normalize data into canonical entity shape
  - Provide migrations (views, indexes)
- **Normalization via Views:** Connectors provide views that extract commonly used fields from `raw_payload`
- **At-Least-Once Delivery:** Idempotency enforced via database constraints and upserts
- **Webhook Endpoint Pattern:** `POST /webhook/{app_key}` for per-instance routing

### Testing Strategy

- Idempotency is critical—re-running syncs must be safe
- Full local Supabase stack for development testing
- Webhook testing via ngrok or similar tunnel service
- Success criteria: synced data is reliable, queryable, and suitable for analytics and AI use cases

### Git Workflow

- GitHub Actions for running migrations and deploying Supabase functions
- Uses latest stable versions of all dependencies
- Connector changes must not require modifications to core logic

## Domain Context

- **Single-Tenant Model:** One Supabase project represents one organization
- **Multi-Connection:** Multiple instances of the same SaaS app may be configured (e.g., `stripe_main`, `stripe_eu`)
- **Deletion Semantics:**
  - Fully deleted upstream records → physically deleted from database
  - Soft states (archived, inactive, trashed) → represented via `archived_at` timestamp
- **API Version Tracking:** `api_version` column tracks upstream API version for schema drift handling
- **Unique Constraint:** `(app_key, collection_key, external_id)` guarantees idempotency

## Important Constraints

- **Self-hosted only:** No hosted SaaS version (explicitly a non-goal)
- **Supabase-first:** Designed specifically for Supabase ecosystem
- **Read-only sync:** No two-way sync / write-back to SaaS APIs (deferred to roadmap)
- **Minimal transformations:** No heavy data transformations beyond normalization via views
- **No cross-entity foreign keys:** SupaSaaSy does not enforce relational integrity across SaaS entities
- **No end-user auth UI:** Authentication/authorization UI deferred to future scope

## External Dependencies

**Phase 1 - Stripe:**

- Stripe API & Webhooks
- Supported resources: Customers, Products, Prices, Plans, Subscriptions, Subscription Items
- Excluded (Phase 1): Invoices, PaymentIntents, Charges

**Phase 2 - Intercom:**

- Validates multi-connector architecture

**Future:**

- Notion
- Slack

**Infrastructure:**

- Supabase (Database, Edge Functions, Secrets Management)
- GitHub Actions (CI/CD)
- ngrok (optional, local webhook testing)
