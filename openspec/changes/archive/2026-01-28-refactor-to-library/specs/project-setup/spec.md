## MODIFIED Requirements

### Requirement: Supabase Project Structure

The library SHALL include an example project initialized as a standard Supabase project with Edge Functions support.

#### Scenario: Example project initialization complete

- **WHEN** a developer clones the repository for development
- **THEN** the `examples/starter/supabase/` directory SHALL contain valid `config.toml`
- **AND** the example project SHALL be runnable with `supabase start`

#### Scenario: Edge Functions as thin wrappers

- **WHEN** a developer examines the example Edge Functions
- **THEN** the `examples/starter/supabase/functions/webhook/index.ts` SHALL import from `supasaasy`
- **AND** the function body SHALL only call `createWebhookHandler(config)`
- **AND** the `examples/starter/supabase/functions/sync/index.ts` SHALL follow the same pattern

### Requirement: TypeScript Configuration

The project SHALL use TypeScript with strict mode configured for Deno runtime via Deno workspaces.

#### Scenario: Workspace configuration

- **WHEN** the repository is cloned
- **THEN** the root `deno.json` SHALL define workspace members
- **AND** `packages/supasaasy` SHALL be a workspace member
- **AND** `examples/starter` SHALL be a workspace member

#### Scenario: Example imports from local package

- **WHEN** developing locally
- **THEN** `examples/starter/deno.json` SHALL import `supasaasy` from `../../packages/supasaasy/mod.ts`
- **AND** changes to the package SHALL be reflected immediately without publishing

#### Scenario: Package exports via mod.ts

- **WHEN** the library is imported
- **THEN** `packages/supasaasy/mod.ts` SHALL export all public APIs
- **AND** internal modules SHALL NOT be directly importable

### Requirement: Configuration File

Users SHALL create a type-safe configuration file that imports from the supasaasy package.

#### Scenario: Configuration imports defineConfig

- **WHEN** a user configures SupaSaaSy
- **THEN** they SHALL use `import { defineConfig } from 'supasaasy'`
- **AND** they SHALL call `defineConfig({ ... })` with their configuration

#### Scenario: Configuration example in starter project

- **WHEN** a developer examines the example project
- **THEN** `examples/starter/supasaasy.config.ts` SHALL demonstrate configuration with `defineConfig`
- **AND** the example SHALL show Stripe setup with comments

### Requirement: Environment Variables

The example project SHALL document required environment variables with examples.

#### Scenario: Environment template exists in example

- **WHEN** a developer examines the example project
- **THEN** `examples/starter/.env.example` SHALL list all required environment variables
- **AND** variable names SHALL match connector documentation

### Requirement: Local Development Support

The example project SHALL support local development with the full Supabase stack and webhook tunneling.

#### Scenario: Local stack starts successfully

- **WHEN** a developer runs `supabase start` in `examples/starter/`
- **THEN** the local Postgres database SHALL be available
- **AND** Edge Functions SHALL be servable locally via `supabase functions serve`

#### Scenario: Webhook testing with ngrok documented

- **WHEN** a developer needs to test webhooks locally
- **THEN** documentation SHALL explain ngrok or cloudflare tunnel setup
- **AND** the webhook URL pattern SHALL be documented (e.g., `https://<tunnel>/functions/v1/webhook`)

#### Scenario: Local development script provided

- **WHEN** a developer wants to start local development
- **THEN** a script or documented command sequence SHALL start Supabase and serve functions
- **AND** the script SHALL work from the `examples/starter/` directory

### Requirement: Migration Generation Script

The example project SHALL include a script for generating database migrations from the library.

#### Scenario: Migration script uses getMigrations

- **WHEN** `deno task generate-migrations` is run in the example project
- **THEN** it SHALL call `getMigrations(config)` from the supasaasy package
- **AND** it SHALL write the result to `supabase/migrations/`

#### Scenario: Migration script is idempotent

- **WHEN** the migration script is run multiple times
- **THEN** it SHALL overwrite the previous migration file
- **AND** the Supabase CLI SHALL handle applying only new changes

### Requirement: CI/CD Pipeline

The repository SHALL include GitHub Actions workflows for publishing the library.

#### Scenario: JSR publish workflow

- **WHEN** a release tag is pushed
- **THEN** a GitHub Actions workflow SHALL publish to JSR
- **AND** the workflow SHALL validate the package before publishing

#### Scenario: CI validates package

- **WHEN** a PR is opened
- **THEN** CI SHALL run `deno check` on the package
- **AND** CI SHALL run tests for the package

### Requirement: Developer Documentation

The repository SHALL include documentation for both library users and contributors.

#### Scenario: README explains library usage

- **WHEN** a user visits the repository
- **THEN** README.md SHALL explain how to install from JSR
- **AND** README.md SHALL show minimal setup code example

#### Scenario: Example project has its own README

- **WHEN** a developer works on the example project
- **THEN** `examples/starter/README.md` SHALL explain local development setup
- **AND** it SHALL explain how to generate and apply migrations

## REMOVED Requirements

### Requirement: Connector Template Generator

**Reason**: The generator creates connectors in the scaffold structure. With the library architecture, connector development happens within `packages/supasaasy/src/connectors/`. A new generator for library-style connectors will be addressed in a separate proposal.

**Migration**: Developers creating new connectors should copy an existing connector directory within `packages/supasaasy/src/connectors/` as a starting point.
