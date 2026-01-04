# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development
bun dev                    # Start dev server with HMR (watches routes + hot reload)
bun run generate-routes    # Generate TanStack Router routes manually

# Building
bun run build              # Build for web (HTML + assets to dist/)
bun run build:mac          # Build macOS executable (dist/i-migrate)
bun run build:windows      # Build Windows executable (dist/i-migrate.exe)

# Database
bun run db:generate        # Generate Drizzle migrations
bun run db:migrate         # Run migrations
bun run db:push            # Push schema changes (dev)
bun run db:studio          # Open Drizzle Studio

# Quality
bun run lint               # Run oxlint
bun run lint:fix           # Auto-fix lint issues
bun run format             # Format with oxfmt
bun run format:check       # Check formatting

# Testing
bun test                   # Run all tests
bun test --watch           # Watch mode
bun test test/encryption   # Run single test file
```

## Architecture Overview

**i-migrate** is a desktop data migration tool for iMIS (association management software) built with Bun, React, and Effect.

### Full-Stack in Single Process

The app runs as a single Bun process serving both the HTTP server and React SPA:
- `src/index.ts` - Entry point that creates Bun server with RPC endpoint at `/rpc`
- `src/frontend.tsx` - React SPA entry point rendered from `src/index.html`
- Bun's native HTML imports handle bundling frontend assets automatically

### Backend: Effect + RPC

The backend uses [Effect](https://effect.website) for typed, composable async operations:

- **RPC Layer** (`src/api/`):
  - `procedures.ts` - RPC endpoint definitions with Effect Schemas
  - `handlers.ts` - RPC handler implementations
  - `schemas.ts` - Shared types and validation schemas
  - `imis-schemas.ts` - iMIS API response schemas

- **Services** (`src/services/`): Effect.Service pattern with dependency injection
  - `persistence.ts` - SQLite operations via Drizzle
  - `session.ts` - In-memory password/token storage (never persisted)
  - `imis-api.ts` - iMIS REST API client with retry logic
  - `migration-job.ts` - Job execution with concurrent batch processing
  - `trace-store.ts` - Custom Effect tracer for observability

- **Database** (`src/db/`): SQLite with Drizzle ORM
  - `schema.ts` - Table definitions (environments, jobs, failedRows, traces, spans)
  - `client.ts` - Database connection
  - Data stored in `data/i-migrate.db`

### Frontend: React + TanStack

- **Routing**: TanStack Router with file-based routes in `src/routes/`
- **State**:
  - Server state via TanStack Query (`src/lib/queries.ts`, `src/lib/mutations.ts`)
  - Client state via Zustand (`src/stores/`)
- **RPC Client**: `src/api/client.ts` - Type-safe API functions using Effect RPC
- **UI**: shadcn/ui components in `src/components/ui/`

### Key Patterns

**Effect Services**: Define with `Effect.Service<T>()()` pattern, access via `ServiceName.methodName()` accessors:
```typescript
export class MyService extends Effect.Service<MyService>()("app/MyService", {
  accessors: true,
  effect: Effect.gen(function* () { /* ... */ })
}) {}
```

**RPC Procedures**: Define with `Rpc.make()`, group with `RpcGroup.make()`:
```typescript
const MyProcedure = Rpc.make("my.procedure", {
  payload: MyInputSchema,
  success: MyOutputSchema,
  error: Schema.Union(Error1, Error2)
})
```

**Path alias**: Use `@/*` for imports from `src/*`

## Testing

Tests are in `test/` directory using Bun's test runner. Tests can use Effect's test layers:
```typescript
import { PersistenceService } from "../src/services/persistence"
// Use PersistenceService.Test for mock layer
```

## Effect Code Style Guide

Reference patterns from `vendor/effect/` (git subtree of Effect monorepo) when writing Effect code.

### Imports

Use namespace imports for Effect modules:
```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { pipe } from "effect/Function"
```

Or destructured from "effect" for common items:
```typescript
import { Effect, Layer, Schema, Data, Context, pipe } from "effect"
```

### Effect.gen (Preferred for Complex Logic)

Use `Effect.gen` with `function*` and `yield*` for sequential async operations:
```typescript
const myEffect = Effect.gen(function* () {
  const config = yield* ConfigService
  const result = yield* someAsyncOperation(config.value)
  return result
})
```

Use `pipe` for simple transformations and method chaining:
```typescript
const simple = pipe(
  Effect.succeed(42),
  Effect.map((n) => n * 2),
  Effect.flatMap((n) => Effect.succeed(n.toString()))
)
```

### Error Handling

Define domain errors with `Data.TaggedError`:
```typescript
export class MyError extends Data.TaggedError("MyError")<{
  readonly message: string
  readonly cause?: unknown
}> {}
```

Or with Schema for RPC errors:
```typescript
class MyError extends Schema.TaggedError<MyError>()("MyError", {
  message: Schema.String
}) {}
```

Use `Effect.catchTag` / `Effect.catchTags` for typed error recovery:
```typescript
pipe(
  myEffect,
  Effect.catchTags({
    NotFoundError: (e) => Effect.succeed(defaultValue),
    ValidationError: (e) => Effect.fail(new MyError({ message: e.message }))
  })
)
```

### Services

Modern `Effect.Service` pattern (Effect 3.9+):
```typescript
export class MyService extends Effect.Service<MyService>()("app/MyService", {
  accessors: true,  // Enables MyService.methodName() static accessors
  effect: Effect.gen(function* () {
    const dep = yield* SomeDependency
    return {
      doSomething: (input: string) => Effect.gen(function* () {
        // implementation
      })
    }
  }),
  dependencies: [SomeDependency.Default]  // Auto-provided when using MyService.Default
}) {
  // Static test layer for mocking
  static Test = Layer.succeed(this, new MyService({
    doSomething: () => Effect.succeed("mock")
  }))
}
```

### Layers

Compose layers with `Layer.provide`, `Layer.merge`, `Layer.provideMerge`:
```typescript
const AppLayer = Layer.mergeAll(
  ServiceA.Default,
  ServiceB.Default,
  ServiceC.Default
)

// Provide dependencies to a layer
const FullLayer = MyService.Default.pipe(
  Layer.provide(DependencyLayer)
)
```

### Concurrency

Use `Effect.forEach` with concurrency option:
```typescript
yield* Effect.forEach(
  items,
  (item) => processItem(item),
  { concurrency: 10 }
)
```

Use `Effect.all` for parallel execution:
```typescript
const [a, b, c] = yield* Effect.all([
  effectA,
  effectB,
  effectC
], { concurrency: "unbounded" })
```

### Retry and Scheduling

```typescript
import * as Schedule from "effect/Schedule"
import * as Duration from "effect/Duration"

const retrySchedule = Schedule.exponential(Duration.millis(500), 2).pipe(
  Schedule.intersect(Schedule.recurs(3))
)

yield* myEffect.pipe(
  Effect.retry({
    schedule: retrySchedule,
    while: (error) => error._tag === "TransientError"
  })
)
```

### Resource Management

Use `Effect.acquireRelease` for resources:
```typescript
const managed = Effect.acquireRelease(
  Effect.sync(() => openConnection()),
  (conn) => Effect.sync(() => conn.close())
)

// Or with Effect.scoped for automatic cleanup
yield* Effect.scoped(
  Effect.flatMap(managed, (conn) => useConnection(conn))
)
```

### Tracing

Add spans with `Effect.withSpan`:
```typescript
const traced = myEffect.pipe(
  Effect.withSpan("operation.name", {
    attributes: { key: "value" }
  })
)
```
