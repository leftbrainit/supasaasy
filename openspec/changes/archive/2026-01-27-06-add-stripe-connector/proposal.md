# Change: Add Stripe Connector

## Why
Stripe is the first connector for SupaSaaSy as specified in Phase 1 of the PRD. It validates the connector interface design and provides immediate value for the target users—developers building on Supabase with Stripe integration.

## What Changes
- Implement Stripe connector conforming to connector interface
- Support webhook verification using Stripe SDK
- Support sync for: Customers, Products, Prices, Plans, Subscriptions, Subscription Items
- Create views for commonly queried Stripe fields
- Add Stripe-specific normalization for archived states

## Impact
- Affected specs: `stripe-connector` (new capability)
- Affected code: `supabase/functions/_shared/connectors/stripe/`
- Depends on: connector-interface, webhook-infrastructure, periodic-sync
