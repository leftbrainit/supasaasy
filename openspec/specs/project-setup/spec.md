# project-setup Specification

## Purpose

TBD - created by archiving change 01-add-project-scaffold. Update Purpose after archive.

## Requirements

### Requirement: Supabase Project Structure

The project SHALL be initialized as a standard Supabase project with Edge Functions support.

#### Scenario: Project initialization complete

- **WHEN** the repository is cloned
- **THEN** the `supabase/` directory SHALL contain valid `config.toml`
- **AND** the project SHALL be runnable with `supabase start`

#### Scenario: Edge Functions directory exists

- **WHEN** a developer needs to create a new Edge Function
- **THEN** the `supabase/functions/` directory SHALL exist
- **AND** the `supabase/functions/_shared/` directory SHALL exist for shared code

### Requirement: TypeScript Configuration

The project SHALL use TypeScript with strict mode configured for Deno runtime.

#### Scenario: Type checking enabled

- **WHEN** a developer writes TypeScript code
- **THEN** the `deno.json` configuration SHALL enable strict type checking
- **AND** import maps SHALL resolve Supabase dependencies

#### Scenario: Shared types available

- **WHEN** an Edge Function imports shared types
- **THEN** the import SHALL resolve from `_shared/types/`

### Requirement: Configuration File

The project SHALL provide a type-safe configuration file for defining app instances.

#### Scenario: Configuration schema defined

- **WHEN** a developer configures SupaSaaSy
- **THEN** they SHALL use `supasaasy.config.ts` with TypeScript types
- **AND** the configuration SHALL support multiple app instances per provider

#### Scenario: Configuration example provided

- **WHEN** a developer sets up the project
- **THEN** an example configuration SHALL demonstrate Stripe setup with `app_key`

### Requirement: Environment Variables

The project SHALL document required environment variables with examples.

#### Scenario: Environment template exists

- **WHEN** a developer clones the repository
- **THEN** `.env.example` SHALL list all required environment variables
- **AND** `.env.local.example` SHALL list local development secrets

#### Scenario: Admin API key documented

- **WHEN** manual sync endpoints are called
- **THEN** the environment SHALL include an admin API key variable

### Requirement: Local Development Support

The project SHALL support local development with the full Supabase stack.

#### Scenario: Local stack starts successfully

- **WHEN** a developer runs `supabase start`
- **THEN** the local Postgres database SHALL be available
- **AND** Edge Functions SHALL be deployable locally

#### Scenario: Webhook testing documented

- **WHEN** a developer needs to test webhooks locally
- **THEN** documentation SHALL explain ngrok setup for webhook tunneling

### Requirement: CI/CD Pipeline

The project SHALL include GitHub Actions workflows for deployment.

#### Scenario: Migration deployment workflow

- **WHEN** changes are pushed to main branch
- **THEN** a GitHub Actions workflow SHALL run database migrations

#### Scenario: Function deployment workflow

- **WHEN** changes are pushed to main branch
- **THEN** a GitHub Actions workflow SHALL deploy Edge Functions

### Requirement: Developer Documentation

The project SHALL include comprehensive setup documentation.

#### Scenario: README provides quickstart

- **WHEN** a developer clones the repository
- **THEN** README.md SHALL explain how to start local development
- **AND** README.md SHALL explain the project architecture

### Requirement: Connector Template Generator

The project SHALL provide a generator script for scaffolding new connectors.

#### Scenario: Generator creates connector directory

- **WHEN** `deno task new-connector <name>` is run
- **THEN** a directory SHALL be created at `connectors/<name>/`
- **AND** the directory SHALL contain all required connector files

#### Scenario: Generator creates index with registration

- **WHEN** a connector is generated
- **THEN** `index.ts` SHALL be created with connector interface implementation
- **AND** the connector SHALL be registered with the registry
- **AND** placeholder methods SHALL be provided for all interface requirements

#### Scenario: Generator creates types file

- **WHEN** a connector is generated
- **THEN** `types.ts` SHALL be created with:
- **AND** resource type union placeholder
- **AND** collection keys mapping placeholder
- **AND** webhook event types mapping placeholder
- **AND** connector-specific config interface

#### Scenario: Generator creates sync module

- **WHEN** a connector is generated
- **THEN** `sync/index.ts` SHALL be created with fullSync and incrementalSync stubs
- **AND** `sync/resources.ts` SHALL be created with resource sync function template

#### Scenario: Generator creates test scaffolding

- **WHEN** a connector is generated
- **THEN** `__tests__/<name>.test.ts` SHALL be created
- **AND** it SHALL include the conformance test suite call
- **AND** it SHALL include placeholder tests for connector-specific behavior

#### Scenario: Generator creates migration placeholder

- **WHEN** a connector is generated
- **THEN** `migrations/001_views.sql` SHALL be created
- **AND** it SHALL contain commented placeholder SQL for views

#### Scenario: Generator validates connector name

- **WHEN** `deno task new-connector` is run with an invalid name
- **THEN** an error SHALL be shown if the name is not kebab-case
- **OR** if a connector with that name already exists
