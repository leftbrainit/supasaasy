## Context
SupaSaaSy is a Supabase-native data sync framework. The project structure must support:
- Deno-based Edge Functions (webhooks, sync functions)
- PostgreSQL migrations
- Multiple connector implementations
- Local development with full Supabase stack

## Goals / Non-Goals
- **Goals:**
  - Establish consistent, idiomatic Supabase project structure
  - Enable local development with `supabase start`
  - Support GitHub Actions deployment
  - Provide clear developer onboarding path

- **Non-Goals:**
  - Custom build tooling beyond Supabase CLI
  - Alternative runtime support (Node.js, etc.)
  - Docker-based deployment (Supabase handles this)

## Decisions

### Decision: Use Supabase CLI as primary tooling
Standard Supabase CLI provides all required functionality for local development, migrations, and Edge Function deployment. No custom build system needed.

**Alternatives considered:**
- Custom Deno build pipeline: Rejected—adds complexity without benefit
- Turborepo/monorepo tooling: Rejected—overkill for single-project scope

### Decision: Single configuration file in TypeScript
Use `supasaasy.config.ts` for type-safe configuration of app instances and sync schedules.

**Alternatives considered:**
- JSON/YAML config: Rejected—loses type safety and IDE support
- Environment variables only: Rejected—complex configurations become unwieldy

### Decision: Shared code in `_shared/` directory
Edge Functions can import from `_shared/` directory within `supabase/functions/`.

**Alternatives considered:**
- NPM packages: Rejected—adds complexity, Deno import maps are sufficient
- Duplicated code per function: Rejected—violates DRY

## Directory Structure

```
supasaasy/
├── supabase/
│   ├── config.toml              # Supabase local config
│   ├── migrations/              # Database migrations
│   │   └── 00000000000000_init.sql
│   └── functions/
│       ├── _shared/             # Shared utilities
│       │   ├── connectors/      # Connector implementations
│       │   ├── types/           # TypeScript types
│       │   ├── config.ts        # Configuration loader
│       │   └── db.ts            # Database utilities
│       ├── webhook/             # Webhook handler function
│       └── sync/                # Periodic sync function
├── config/
│   └── supasaasy.config.ts      # App configuration
├── scripts/
│   └── dev.sh                   # Local development helper
├── .github/
│   └── workflows/
│       ├── deploy-migrations.yml
│       └── deploy-functions.yml
├── .env.example
├── .env.local.example
├── deno.json
└── README.md
```

## Risks / Trade-offs

- **Risk:** Supabase CLI version drift
  - Mitigation: Pin CLI version in CI, document minimum version in README

- **Risk:** Deno import map complexity
  - Mitigation: Keep imports simple, use Supabase-blessed patterns

## Open Questions
- None blocking for initial scaffold
