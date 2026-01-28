## Context

SupaSaaSy is currently a scaffold project that users clone/fork. This creates friction for updates: users must manually merge upstream changes, resolving conflicts in configuration and customizations. The library approach treats SupaSaaSy as a dependency, simplifying the update story to "bump the version number."

**Stakeholders:**

- Existing users: Need migration path from scaffold to library
- New users: Get cleaner onboarding experience
- Maintainers: Develop against example project, publish to JSR

## Goals / Non-Goals

**Goals:**

- Enable version-pinned dependency installation via JSR
- Provide thin wrapper pattern for Edge Functions
- Expose migrations programmatically via `getMigrations()`
- Support local development with full webhook testing via example project
- Maintain backward compatibility for connector interface internals

**Non-Goals:**

- Automatic template repo syncing (separate proposal)
- Custom connector support within example project (separate proposal)
- CLI tooling beyond migration generation
- npm dual-publishing (JSR only for initial release)

## Decisions

### Decision: Monorepo with packages/ and examples/

The repository becomes a monorepo with Deno workspaces:

```
supasaasy/
├── packages/
│   └── supasaasy/           # The library
│       ├── src/
│       │   ├── connectors/
│       │   ├── handlers/
│       │   ├── db/
│       │   └── types/
│       ├── deno.json        # Package config for JSR
│       └── mod.ts           # Main entrypoint
├── examples/
│   └── starter/             # Example project for development
│       ├── supasaasy.config.ts
│       ├── supabase/
│       │   ├── config.toml
│       │   └── functions/
│       │       ├── webhook/index.ts
│       │       └── sync/index.ts
│       ├── scripts/
│       │   └── generate-migrations.ts
│       ├── .env.example
│       └── deno.json        # Imports from ../../packages/supasaasy
└── deno.json                # Workspace root
```

**Rationale:** Deno workspaces allow local imports during development while the published package uses JSR imports.

### Decision: Function-based handler creation

Edge Functions become thin wrappers using factory functions:

```typescript
// examples/starter/supabase/functions/webhook/index.ts
import { createWebhookHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createWebhookHandler(config));
```

```typescript
// examples/starter/supabase/functions/sync/index.ts
import { createSyncHandler } from 'supasaasy';
import config from '../../../supasaasy.config.ts';

Deno.serve(createSyncHandler(config));
```

**Rationale:** Factory pattern keeps user code minimal while allowing full customization of config. The config is passed at runtime rather than imported from a fixed path.

### Decision: Configuration via defineConfig helper

```typescript
// supasaasy.config.ts
import { defineConfig } from 'supasaasy';

export default defineConfig({
  apps: [
    {
      app_key: 'stripe_prod',
      connector: 'stripe',
      config: {
        api_key_env: 'STRIPE_API_KEY',
        webhook_secret_env: 'STRIPE_WEBHOOK_SECRET',
      },
    },
  ],
  sync_schedules: [
    { app_key: 'stripe_prod', cron: '0 */6 * * *', enabled: true },
  ],
});
```

**Rationale:** `defineConfig` provides TypeScript inference and optional runtime validation without changing the config structure.

### Decision: Migrations via getMigrations() function

Migrations are exposed programmatically rather than via CLI:

```typescript
// examples/starter/scripts/generate-migrations.ts
import { getMigrations } from 'supasaasy';
import config from '../supasaasy.config.ts';

const sql = getMigrations(config);
await Deno.writeTextFile(
  'supabase/migrations/00000000000001_supasaasy.sql',
  sql,
);
console.log('Migration file generated');
```

**Rationale:** This approach (Option B from discussion) keeps migration management explicit, integrates with existing Supabase CLI workflows, and avoids runtime migration complexity. Users run the script after updating the library, then apply via `supabase db push`.

### Decision: Connector exports for tree-shaking

Connectors are exported individually:

```typescript
// Library exports
export { stripeConnector } from './connectors/stripe/index.ts';
export { intercomConnector } from './connectors/intercom/index.ts';
```

Unused connectors are not bundled when tree-shaking is applied.

**Rationale:** Users only pay for connectors they use. The connector registry is populated based on what's configured, not what's imported.

### Decision: JSR as sole distribution channel

Publish to JSR (jsr.io) under `@supasaasy/core`.

**Rationale:** JSR is Deno-native, supports npm compatibility via JSR's npm layer, and handles TypeScript directly without build step. Dual npm publishing can be added later if needed.

## Risks / Trade-offs

| Risk                                               | Impact | Mitigation                                                                     |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| Breaking change for existing users                 | High   | Provide migration guide, keep scaffold branch for legacy support               |
| JSR adoption is still growing                      | Medium | JSR works with npm via compatibility layer; add npm publishing later if needed |
| Migrations require manual regeneration             | Low    | Clear documentation; script is one command                                     |
| Local development requires workspace understanding | Low    | Example project provides working reference                                     |

## Migration Plan

1. Create `packages/supasaasy/` structure with library code
2. Move `supabase/functions/_shared/` → `packages/supasaasy/src/`
3. Create `examples/starter/` with thin wrapper functions
4. Update example to import from local package during development
5. Configure JSR publishing in `packages/supasaasy/deno.json`
6. Write migration guide for existing users
7. Tag final scaffold release as `v0.x-scaffold` for legacy reference
8. Publish `v1.0.0` to JSR

**Rollback:** The scaffold pattern remains available on a tagged branch.

## Open Questions

- Should we publish connectors as separate packages (`@supasaasy/stripe`, `@supasaasy/intercom`) for finer-grained versioning?
- Should the example project include pre-configured ngrok setup or just documentation?
