# Change: Add Unit Testing Infrastructure

## Why

The project currently lacks unit tests, creating risk for regressions as the codebase grows. Adding comprehensive testing ensures connector implementations conform to interface requirements, validates core functionality, and catches bugs before deployment.

## What Changes

- Add testing infrastructure using Deno's built-in test runner
- Create connector conformance test suite that validates any connector against the interface specification
- Add unit tests for the Stripe connector implementation
- Add unit tests for core utilities and shared modules
- **BREAKING**: Update GitHub Actions CI to require tests to pass before deployment

## Impact

- Affected specs: New `testing-infrastructure` spec
- Affected code:
  - `deno.json` (test task configuration)
  - `.github/workflows/ci.yml` (add test job)
  - `.github/workflows/deploy-functions.yml` (require tests to pass)
  - New test files throughout `supabase/functions/_shared/`
