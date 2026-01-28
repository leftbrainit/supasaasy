# Design: Unit Testing Infrastructure

## Context

SupaSaaSy uses Deno for edge functions, which includes a built-in test runner. The project already has `@std/assert` imported in `deno.json`. Tests need to work both locally and in CI, and must validate connector conformance to the interface specification.

### Stakeholders

- Developers adding new connectors (need conformance tests)
- Contributors (need clear testing patterns)
- CI/CD pipeline (needs automated test execution)

## Goals / Non-Goals

### Goals

- Establish testing patterns for connector development
- Create reusable conformance test suite for connectors
- Achieve test coverage for critical paths (webhook handling, sync operations, entity normalization)
- Integrate tests into CI/CD pipeline with blocking enforcement
- Enable fast local test execution during development

### Non-Goals

- Integration tests requiring live SaaS API connections (defer to future)
- End-to-end tests requiring full Supabase stack (handled by migration validation)
- Visual/UI testing (no UI in this project)
- Performance benchmarking (separate concern)

## Decisions

### Decision 1: Use Deno's built-in test runner

**What**: Use `deno test` instead of external frameworks like Jest or Vitest
**Why**:

- Native to Deno runtime, zero additional dependencies
- Already supported by `@std/assert` import in project
- Excellent TypeScript support out of the box
- Snapshot testing available when needed

**Alternatives considered**:

- Jest: Would require Node.js compatibility layer, adds complexity
- Vitest: Good but redundant when Deno has native support

### Decision 2: Test file naming convention

**What**: Use `*.test.ts` suffix for test files (not `*_test.ts`)
**Why**:

- More widely recognized convention
- Consistent with common JavaScript/TypeScript tooling expectations
- Easier glob patterns in CI

### Decision 3: Connector conformance test suite pattern

**What**: Create a reusable test suite function that validates any connector against the interface
**Why**:

- Ensures all connectors meet the same quality bar
- Reduces duplicate test code across connectors
- Makes adding new connectors easier - just run conformance suite
- Tests can reference spec requirements directly

**Implementation approach**:

```typescript
// Example pattern
export function testConnectorConformance(connector: Connector) {
  // Tests metadata requirements
  // Tests webhook interface
  // Tests sync interface
  // Tests entity normalization
}
```

### Decision 4: Mock strategy for external dependencies

**What**: Use lightweight mocks/stubs for Stripe SDK and database operations
**Why**:

- Unit tests should be fast and deterministic
- Avoid flaky tests from network calls
- Enable testing edge cases and error scenarios

**Approach**:

- Create mock factories for Stripe API responses
- Mock database functions from `db.ts` using test doubles
- Use dependency injection where needed for testability

### Decision 5: CI test gate placement

**What**: Add test job to CI workflow, make it a required status check
**Why**:

- Prevents merging code that breaks tests
- Runs on both push and pull_request events
- Fast feedback for contributors

## Risks / Trade-offs

### Risk: Test maintenance overhead

- **Risk**: Tests may become stale or require frequent updates
- **Mitigation**: Focus on testing behavior not implementation, use conformance tests that derive from specs

### Risk: Mock drift from real API behavior

- **Risk**: Mocks may not accurately reflect real Stripe API responses
- **Mitigation**: Generate mock data from actual API response examples, update when API version changes

### Trade-off: Test isolation vs. coverage

- **Trade-off**: Fully isolated unit tests miss integration issues
- **Decision**: Accept this trade-off; integration testing is a separate future concern

## Test Organization

```
supabase/functions/_shared/
├── connectors/
│   ├── __tests__/
│   │   ├── conformance.test.ts     # Reusable conformance suite
│   │   └── mocks/
│   │       └── index.ts            # Shared mock utilities
│   ├── stripe/
│   │   └── __tests__/
│   │       ├── stripe.test.ts      # Stripe-specific tests
│   │       └── mocks.ts            # Stripe mock data
│   └── index.test.ts               # Registry tests
├── config.test.ts                  # Config loading tests
├── db.test.ts                      # Database utility tests
└── types/
    └── index.test.ts               # Type guard tests
```

## Migration Plan

1. Add test infrastructure and first tests
2. Update CI to run tests (initially non-blocking)
3. Add comprehensive test coverage
4. Make tests blocking in CI
5. Update deploy workflows to require CI pass

### Rollback

- Revert CI changes if tests cause deployment issues
- Tests are additive and can be disabled via config if needed

## Open Questions

- None at this time; all decisions made based on project context
