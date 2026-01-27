## Context
Stripe is the first connector implementation for SupaSaaSy. It serves as the reference implementation for the connector interface and validates the overall architecture.

Phase 1 scope from PRD:
- **Included:** Customers, Products, Prices, Plans, Subscriptions, Subscription Items
- **Excluded:** Invoices, PaymentIntents, Charges

## Goals / Non-Goals
- **Goals:**
  - Full implementation of connector interface for Stripe
  - Reliable webhook processing for real-time updates
  - Efficient periodic sync with pagination support
  - Useful views for common Stripe queries

- **Non-Goals:**
  - Transaction-level data (Invoices, Charges, PaymentIntents)
  - Stripe Connect support
  - Custom Stripe events beyond standard resource lifecycle

## Decisions

### Decision: Use official Stripe SDK for Deno
The Stripe npm package works in Deno via npm specifier. This provides:
- Automatic webhook signature verification
- Type-safe API calls
- Built-in rate limit handling

**Alternatives considered:**
- Raw HTTP calls: Rejected—loses SDK benefits, more error-prone
- Third-party Deno Stripe library: Rejected—less maintained than official SDK

### Decision: Collection key naming convention
Use `stripe_` prefix for all collection keys:
- `stripe_customer`
- `stripe_product`
- `stripe_price`
- `stripe_plan`
- `stripe_subscription`
- `stripe_subscription_item`

This matches the PRD convention and ensures uniqueness across connectors.

### Decision: Archived state mapping
Stripe uses different fields for "soft delete" states:
- Products: `active: false` → `archived_at`
- Prices: `active: false` → `archived_at`
- Customers: `deleted: true` → physical delete
- Subscriptions: `status: canceled` → `archived_at`

### Decision: Webhook events to handle
Focus on resource lifecycle events:
- `*.created` → insert entity
- `*.updated` → upsert entity
- `*.deleted` → delete entity

For subscriptions, also handle:
- `customer.subscription.deleted` → set `archived_at` (canceled)

## Resource Details

### Customers
- **Stripe endpoint:** `stripe.customers.list()`
- **Webhook events:** `customer.created`, `customer.updated`, `customer.deleted`
- **Archived detection:** `deleted: true` triggers physical delete
- **Key fields for view:** id, email, name, metadata, created

### Products
- **Stripe endpoint:** `stripe.products.list()`
- **Webhook events:** `product.created`, `product.updated`, `product.deleted`
- **Archived detection:** `active: false` sets `archived_at`
- **Key fields for view:** id, name, description, active, metadata

### Prices
- **Stripe endpoint:** `stripe.prices.list()`
- **Webhook events:** `price.created`, `price.updated`, `price.deleted`
- **Archived detection:** `active: false` sets `archived_at`
- **Key fields for view:** id, product, unit_amount, currency, recurring

### Plans (Legacy)
- **Stripe endpoint:** `stripe.plans.list()`
- **Webhook events:** `plan.created`, `plan.updated`, `plan.deleted`
- **Archived detection:** `active: false` sets `archived_at`
- **Note:** Plans are legacy; Prices are preferred but Plans still widely used

### Subscriptions
- **Stripe endpoint:** `stripe.subscriptions.list()`
- **Webhook events:** `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Archived detection:** `status: canceled` sets `archived_at`
- **Key fields for view:** id, customer, status, items, current_period_start, current_period_end

### Subscription Items
- **Stripe endpoint:** via subscription expand or `stripe.subscriptionItems.list()`
- **Webhook events:** Updated via subscription webhooks
- **Key fields for view:** id, subscription, price, quantity

## Risks / Trade-offs

- **Risk:** Stripe API version drift
  - Mitigation: Store `api_version` in entity, use SDK's default version, document upgrade path

- **Risk:** High webhook volume
  - Mitigation: Idempotent processing, efficient upserts

- **Trade-off:** Plans vs Prices duplication
  - Decision: Support both since many accounts still use Plans

## Open Questions
- None blocking for Phase 1
