# CLAUDE.md

## What

i-migrate: Desktop data migration tool for iMIS (association management software).

Stack: Bun, React, Effect, TanStack Router/Query, Drizzle ORM, SQLite, shadcn/ui

### Key Directories

- `src/api/` - RPC procedures, handlers, schemas
- `src/services/` - Effect services (persistence, session, imis-api, migration-job, trace-store)
- `src/routes/` - TanStack Router file-based routes
- `src/components/ui/` - shadcn/ui components
- `src/db/` - Drizzle schema and client
- `src/stores/` - Zustand client state
- `src/lib/` - TanStack Query hooks (queries.ts, mutations.ts)
- `test/` - Bun tests
- `vendor/effect/` - Effect monorepo subtree (reference patterns here)

## Why

- Single Bun process serves HTTP server + React SPA (`src/index.ts` entry point)
- Effect for typed, composable async with dependency injection
- RPC layer (`/rpc` endpoint) for type-safe frontend-backend communication
- Data stored in `data/i-migrate.db`

## How

### Commands

```bash
bun dev              # Dev server with HMR
bun run build        # Build for web (dist/)
bun test             # Run tests
bun run lint         # oxlint
bun run format       # oxfmt
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run migrations
bun run db:push      # Push schema changes (dev)
```

### Development

- Path alias: `@/*` → `src/*`
- For Effect patterns, reference the `/effect` skill
- For iMIS API patterns, the `imis-api` skill triggers automatically
- Tests use Bun test runner + Effect test layers (e.g., `PersistenceService.Test`)

### Key Patterns

- `Effect.Service` with `accessors: true` for static method access
- `Rpc.make()` + `RpcGroup.make()` for RPC procedures
- `Schema.TaggedError` for RPC errors
- `Data.TaggedError` for domain errors
