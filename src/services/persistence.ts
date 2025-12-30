import { Effect, Context, Layer, Data } from "effect"
import { eq } from "drizzle-orm"
import { db } from "../db/client"
import { environments, type Environment, type NewEnvironment } from "../db/schema"

// Domain errors
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class EnvironmentNotFoundError extends Data.TaggedError("EnvironmentNotFoundError")<{
  readonly id: string
}> {}

// Service interface
export type PersistenceService = {
  readonly getEnvironments: () => Effect.Effect<Environment[], DatabaseError>
  readonly getEnvironmentById: (id: string) => Effect.Effect<Environment, DatabaseError | EnvironmentNotFoundError>
  readonly createEnvironment: (env: NewEnvironment) => Effect.Effect<Environment, DatabaseError>
  readonly updateEnvironment: (
    id: string,
    updates: Partial<Pick<Environment, "name" | "baseUrl" | "username">>
  ) => Effect.Effect<Environment, DatabaseError | EnvironmentNotFoundError>
  readonly deleteEnvironment: (id: string) => Effect.Effect<void, DatabaseError | EnvironmentNotFoundError>
}

// Service tag
export const PersistenceService = Context.GenericTag<PersistenceService>("app/PersistenceService")

// Service implementation
const makePersistenceService = (): PersistenceService => ({
  getEnvironments: () =>
    Effect.try({
      try: () => db.select().from(environments).all(),
      catch: (cause) => new DatabaseError({ message: "Failed to fetch environments", cause }),
    }),

  getEnvironmentById: (id: string) =>
    Effect.gen(function* () {
      const results = yield* Effect.try({
        try: () => db.select().from(environments).where(eq(environments.id, id)).all(),
        catch: (cause) => new DatabaseError({ message: "Failed to fetch environment", cause }),
      })

      const environment = results[0]
      if (!environment) {
        return yield* Effect.fail(new EnvironmentNotFoundError({ id }))
      }

      return environment
    }),

  createEnvironment: (env: NewEnvironment) =>
    Effect.gen(function* () {
      yield* Effect.try({
        try: () => db.insert(environments).values(env).run(),
        catch: (cause) => new DatabaseError({ message: "Failed to create environment", cause }),
      })

      const results = yield* Effect.try({
        try: () => db.select().from(environments).where(eq(environments.id, env.id)).all(),
        catch: (cause) => new DatabaseError({ message: "Failed to fetch created environment", cause }),
      })

      const created = results[0]
      if (!created) {
        return yield* Effect.fail(new DatabaseError({ message: "Environment was created but could not be retrieved" }))
      }

      return created
    }),

  updateEnvironment: (id: string, updates: Partial<Pick<Environment, "name" | "baseUrl" | "username">>) =>
    Effect.gen(function* () {
      // First check if environment exists
      const existing = yield* Effect.try({
        try: () => db.select().from(environments).where(eq(environments.id, id)).all(),
        catch: (cause) => new DatabaseError({ message: "Failed to fetch environment", cause }),
      })

      if (existing.length === 0) {
        return yield* Effect.fail(new EnvironmentNotFoundError({ id }))
      }

      // Update with new timestamp
      const updatedAt = new Date().toISOString()
      yield* Effect.try({
        try: () =>
          db
            .update(environments)
            .set({ ...updates, updatedAt })
            .where(eq(environments.id, id))
            .run(),
        catch: (cause) => new DatabaseError({ message: "Failed to update environment", cause }),
      })

      // Return updated environment
      const results = yield* Effect.try({
        try: () => db.select().from(environments).where(eq(environments.id, id)).all(),
        catch: (cause) => new DatabaseError({ message: "Failed to fetch updated environment", cause }),
      })

      const updated = results[0]
      if (!updated) {
        return yield* Effect.fail(new DatabaseError({ message: "Environment was updated but could not be retrieved" }))
      }

      return updated
    }),

  deleteEnvironment: (id: string) =>
    Effect.gen(function* () {
      // First check if environment exists
      const existing = yield* Effect.try({
        try: () => db.select().from(environments).where(eq(environments.id, id)).all(),
        catch: (cause) => new DatabaseError({ message: "Failed to fetch environment", cause }),
      })

      if (existing.length === 0) {
        return yield* Effect.fail(new EnvironmentNotFoundError({ id }))
      }

      yield* Effect.try({
        try: () => db.delete(environments).where(eq(environments.id, id)).run(),
        catch: (cause) => new DatabaseError({ message: "Failed to delete environment", cause }),
      })
    }),
})

// Layer
export const PersistenceServiceLive = Layer.succeed(PersistenceService, makePersistenceService())
