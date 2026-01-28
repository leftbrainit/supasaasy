## 1. Connector Setup

- [x] 1.1 Create `supabase/functions/_shared/connectors/stripe/` directory
- [x] 1.2 Add Stripe SDK to import map (latest version)
- [x] 1.3 Create connector metadata and registration

## 2. Webhook Implementation

- [x] 2.1 Implement webhook signature verification using Stripe SDK
- [x] 2.2 Map Stripe event types to internal event types
- [x] 2.3 Extract entity from webhook payload
- [x] 2.4 Handle Stripe-specific event structure

## 3. Resource Handlers

- [x] 3.1 Implement Customer sync (list, normalize, archived detection)
- [x] 3.2 Implement Product sync (list, normalize, archived detection)
- [x] 3.3 Implement Price sync (list, normalize, archived detection)
- [x] 3.4 Implement Plan sync (list, normalize, archived detection)
- [x] 3.5 Implement Subscription sync (list, normalize, status handling)
- [x] 3.6 Implement Subscription Item sync (list, normalize)

## 4. Entity Normalization

- [x] 4.1 Define collection_key mapping (e.g., "stripe_customer")
- [x] 4.2 Implement archived state detection per resource type
- [x] 4.3 Extract external_id from Stripe objects
- [x] 4.4 Store api_version from Stripe response

## 5. Sync Implementation

- [x] 5.1 Implement full sync with pagination using Stripe SDK
- [x] 5.2 Implement incremental sync using `created` filter
- [x] 5.3 Handle Stripe rate limits (SDK handles automatically)
- [x] 5.4 Detect deleted entities for full sync reconciliation

## 6. Database Views

- [x] 6.1 Create migration for `stripe_customers` view
- [x] 6.2 Create migration for `stripe_products` view
- [x] 6.3 Create migration for `stripe_prices` view
- [x] 6.4 Create migration for `stripe_subscriptions` view
- [x] 6.5 Add indexes for view optimization

## 7. Testing & Documentation

- [x] 7.1 Document required Stripe environment variables
- [x] 7.2 Document Stripe webhook setup instructions
- [x] 7.3 Add example configuration for Stripe app instance
