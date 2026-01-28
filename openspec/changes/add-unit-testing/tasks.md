# Tasks: Add Unit Testing Infrastructure

## 1. Test Infrastructure Setup

- [x] 1.1 Add `test` task to `deno.json` with appropriate configuration
- [x] 1.2 Add test-related scripts to `deno.json` (test:watch, test:coverage)
- [x] 1.3 Create shared mock utilities in `supabase/functions/_shared/connectors/__tests__/mocks/index.ts`
- [x] 1.4 Create database mock helpers for `db.ts` functions

## 2. Connector Conformance Test Suite

- [x] 2.1 Create conformance test suite in `supabase/functions/_shared/connectors/__tests__/conformance.test.ts`
- [x] 2.2 Test connector metadata requirements (name, version, apiVersion, resources)
- [x] 2.3 Test webhook handler interface requirements (verify, parse, extract)
- [x] 2.4 Test sync handler interface requirements (fullSync, incrementalSync where supported)
- [x] 2.5 Test entity normalization requirements (externalId, collectionKey, rawPayload)

## 3. Stripe Connector Unit Tests

- [x] 3.1 Create Stripe mock data generators in `supabase/functions/_shared/connectors/stripe/__tests__/mocks.ts`
- [x] 3.2 Create Stripe connector tests in `supabase/functions/_shared/connectors/stripe/__tests__/stripe.test.ts`
- [x] 3.3 Test webhook signature verification (valid, invalid, missing)
- [x] 3.4 Test webhook event parsing for all supported event types
- [x] 3.5 Test entity normalization for each supported resource type
- [x] 3.6 Test archived_at detection for subscription states
- [x] 3.7 Test sync_from filtering logic in full sync
- [x] 3.8 Run conformance test suite against Stripe connector

## 4. Core Module Unit Tests

- [x] 4.1 Create connector registry tests in `supabase/functions/_shared/connectors/index.test.ts`
- [x] 4.2 Test connector registration and lookup
- [x] 4.3 Test getConnectorForAppKey with various configurations
- [x] 4.4 Create config loading tests in `supabase/functions/_shared/config.test.ts`
- [x] 4.5 Create utility function tests in `supabase/functions/_shared/connectors/utils.test.ts`

## 5. CI/CD Integration

- [x] 5.1 Add `test` job to `.github/workflows/ci.yml`
- [x] 5.2 Configure test job to run `deno test` with coverage
- [x] 5.3 Add test job as dependency for deploy workflows
- [x] 5.4 Update `.github/workflows/deploy-functions.yml` to require CI pass
- [x] 5.5 Update `.github/workflows/deploy-migrations.yml` to require CI pass

## 6. Documentation & Verification

- [x] 6.1 Run full test suite locally to verify all tests pass
- [x] 6.2 Verify CI workflow runs tests successfully
- [x] 6.3 Document testing conventions in README or contributing guide
