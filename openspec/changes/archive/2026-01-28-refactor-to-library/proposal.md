# Change: Refactor to Library Architecture

## Why

The current scaffold architecture requires users to clone/fork the repository and merge upstream changes manually, leading to conflicts and making updates cumbersome. Converting SupaSaaSy to a library published on JSR enables clean dependency management—users install the package, import handlers, and receive updates via simple version bumps.

## What Changes

- **BREAKING**: Project structure changes from scaffold to library + example project
- **BREAKING**: Configuration API changes from file-path imports to function-based setup
- **BREAKING**: Edge Functions become thin wrappers that import from the library
- Library published to JSR (jsr.io) as `@supasaasy/core`
- Migrations exposed via `getMigrations()` function for consumer-side generation
- Connectors exported as individual imports for tree-shaking
- Example project in `examples/starter/` for local development and testing
- Local development uses example project with Supabase CLI + ngrok

## Impact

- Affected specs: `project-setup`, `connector-interface` (new: `library-distribution`)
- Affected code: All files restructured into `packages/supasaasy/` and `examples/starter/`
- Users: Must migrate from scaffold to library import pattern (migration guide needed)
