# SupaSaaSy – Product Requirements Document (PRD)

## 1. Overview

**Project name:** SupaSaaSy\
**Repository:** `leftbrainit/supasaasy`\
**Type:** Open source (self‑hosted, Supabase‑native)

SupaSaaSy is an open‑source framework that synchronizes data from popular SaaS business applications into a Supabase (Postgres) database. It supports both low‑latency ingestion via webhooks and configurable periodic synchronization via APIs, enabling businesses to maintain an up‑to‑date, unified data layer across their tools.

The project is designed to be opinionated, Supabase‑first, and developer‑friendly, prioritizing correctness, transparency, and extensibility over abstraction-heavy ETL tooling.

---

## 2. Goals & Non‑Goals

### 2.1 Goals

- Provide a **reliable, self‑hosted data sync layer** from SaaS apps into Supabase
- Support **realtime updates** via webhooks with **eventual consistency** via periodic syncs
- Offer a **consistent connector interface** for multiple SaaS applications
- Minimize schema churn through a **single canonical entities table**
- Enable downstream use cases:
  - Cross‑app analytics
  - Dashboards & client portals
  - Automation & reverse‑ETL‑style workflows
  - AI context retrieval (vector search, RAG)
- Be easy to run locally and deploy via Supabase + GitHub Actions

### 2.2 Non‑Goals (Initial Scope)

- ❌ Hosted SaaS version of SupaSaaSy
- ❌ Heavy data transformations beyond normalization via views
- ❌ Enforcing relational integrity across SaaS entities
- ❌ End‑user authentication or authorization UI (initially)

### 2.3 Explicitly Deferred / Roadmap Items

- Two‑way sync (writing back to SaaS APIs)
- User‑facing UI for triggering syncs and viewing status
- Unified REST & GraphQL APIs over synced data
- RLS policy generation from configuration
- pgVector integration for embeddings and RAG

---

## 3. Target Users

- Developers and startups already using **Supabase** as their primary backend
- Agencies and consultants building internal tools or client portals
- Teams building AI‑powered products that require **ground‑truth SaaS data**

Assumption: **one Supabase project represents one organization**, but multiple instances of the same SaaS app may be configured.

---

## 4. Core Concepts

### 4.1 Single‑Tenant, Multi‑Connection Model

- SupaSaaSy is **single‑tenant** per Supabase project
- Each SaaS app may have **multiple configured instances** (e.g. `stripe_main`, `stripe_eu`)
- Each instance is identified by a user‑defined `app_key`

---

## 5. Data Model

### 5.1 Canonical `entities` Table

SupaSaaSy owns the database schema. All SaaS data is stored in a single canonical table under a user‑configurable schema (default: `supasaasy`).

**Core table:** `entities`

**Columns:**

- `id` (UUID, primary key)
- `external_id` (TEXT) — ID from the SaaS provider
- `app_key` (TEXT) — user‑defined instance key (e.g. `stripe_main`)
- `collection_key` (TEXT) — resource type (e.g. `stripe_customer`)
- `api_version` (TEXT) — upstream API version used to retrieve the record
- `raw_payload` (JSONB) — canonical representation of the entity
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `archived_at` (TIMESTAMPTZ, nullable)
- `deleted_at` (TIMESTAMPTZ, nullable)

**Constraints:**

- Unique constraint on `(app_key, collection_key, external_id)` to guarantee idempotency

### 5.2 Deletion & Archival Semantics

- If a record is **fully deleted** upstream, it is **physically deleted** from the database
- Soft states such as `archived`, `inactive`, or `trashed` are represented using:
  - `archived_at`
- Each connector defines what constitutes `archived` vs `deleted`

### 5.3 Normalization via Views

- Connectors provide migrations that create:
  - Views
  - Indexes
  - Optional materialized views
- Views extract commonly used fields from `raw_payload`
- SupaSaaSy does **not** enforce cross‑entity foreign keys

---

## 6. Sync Architecture

### 6.1 Processing Model

- **At‑least‑once delivery**
- Idempotency enforced via database constraints and upserts

### 6.2 Webhooks

- Webhook endpoint pattern:

```
POST /webhook/{app_key}
```

- Advantages:
  - Prevents conflicts between multiple instances
  - Improves security by allowing verification before payload inspection

- Each connector implements:
  - Webhook verification
  - Event parsing
  - Entity upsert / delete logic

### 6.3 Periodic Sync

- Periodic syncs are **configurable per app instance**
- Implemented using **Supabase scheduled functions** (Postgres‑backed)
- Used for:
  - Backfills
  - Reconciliation
  - API version migrations

### 6.4 Failure Handling

- If a sync fails:
  - The function returns an error
  - Re‑running the sync is safe due to idempotency
- Rate limiting is handled by:
  - Official SDKs where possible
  - Connector‑specific logic otherwise

---

## 7. Connector Interface

Each SaaS connector lives in‑repo and conforms to a shared interface.

**Responsibilities:**

- Define supported resources
- Verify webhooks
- Fetch data via APIs
- Normalize data into canonical entity shape
- Provide migrations (views, indexes)

**Conceptual interface (illustrative):**

- Connector metadata
- Webhook handler
- Full / incremental sync functions
- Migration definitions

---

## 8. Configuration & Developer Experience

### 8.1 Configuration File

A single config file defines:

- Enabled apps
- App instances (`app_key`)
- Periodic sync schedules
- Optional per‑resource toggles

Example (conceptual):

```ts
apps: {
  stripe_main: {
    provider: "stripe",
    schedule: "0 * * * *"
  }
}
```

### 8.2 Environment Variables

- `.env.local` stores API keys and secrets
- Manual sync endpoints require an **admin API key**

### 8.3 Local Development

- Full local Supabase stack
- Optional `ngrok` dependency for webhook testing
- Consistent Deno runtime via Supabase Edge Functions

---

## 9. Deployment

- GitHub Actions provided for:
  - Running migrations
  - Deploying Supabase functions
- Uses latest stable versions of all dependencies
- Prefers official SDKs for SaaS providers

---

## 10. Initial Connector Scope

### Phase 1: Stripe

Supported resources:

- Customers
- Products
- Prices
- Plans
- Subscriptions
- Subscription items

Explicitly excluded (Phase 1):

- Invoices
- PaymentIntents
- Charges

### Phase 2

- Intercom connector (to validate multi‑connector architecture)

### Future

- Notion
- Slack

---

## 11. Security & Compliance Considerations

- No storage of webhook payloads beyond normalized entity records
- Full deletion of data when upstream APIs report deletion
- Reduced attack surface via:
  - Per‑app webhook endpoints
  - Supabase secrets management

---

## 12. Risks & Mitigations

| Risk                   | Mitigation                          |
| ---------------------- | ----------------------------------- |
| Webhook unreliability  | Periodic reconciliation             |
| Schema drift           | `api_version` tracking + resync     |
| Connector complexity   | Strict in‑repo interface & review   |
| OSS maintenance burden | Opinionated scope & clear non‑goals |

---

## 13. Success Criteria

- A developer can:
  - Clone the repo
  - Configure at least one SaaS app
  - Run a local Supabase instance
  - Receive webhooks and perform periodic syncs
- Adding a new connector does not require changes to core logic
- Synced data is reliable, queryable, and suitable for analytics and AI use cases

---

**SupaSaaSy aims to be the default data spine for Supabase‑based products that rely on SaaS ecosystems.**
