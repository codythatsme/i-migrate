import { Effect, Layer, Data } from "effect";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  environments,
  settings,
  type Environment,
  type NewEnvironment,
  type Settings,
} from "../db/schema";

// ---------------------
// Domain Errors
// ---------------------

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class EnvironmentNotFoundError extends Data.TaggedError("EnvironmentNotFoundError")<{
  readonly id: string;
}> {
  override get message() {
    return `Environment not found: ${this.id}`;
  }
}

// ---------------------
// Service Definition
// ---------------------

// Using the modern Effect.Service pattern (Effect 3.9+)
// This combines Context.Tag and Layer creation in one class definition
export class PersistenceService extends Effect.Service<PersistenceService>()(
  "app/PersistenceService",
  {
    // `accessors: true` creates static methods that can be called directly:
    // e.g., PersistenceService.getEnvironments() instead of requiring yield* PersistenceService first
    accessors: true,

    sync: () => {
      // ---------------------
      // Private helpers
      // ---------------------

      const queryEnvironments = () =>
        Effect.try({
          try: () => db.select().from(environments).all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch environments", cause }),
        });

      const queryEnvironmentById = (id: string) =>
        Effect.try({
          try: () => db.select().from(environments).where(eq(environments.id, id)).all(),
          catch: (cause) => new DatabaseError({ message: "Failed to fetch environment", cause }),
        });

      // ---------------------
      // Service Implementation
      // ---------------------

      return {
        getEnvironments: () => queryEnvironments(),

        getEnvironmentById: (id: string) =>
          Effect.gen(function* () {
            const results = yield* queryEnvironmentById(id);
            const environment = results[0];
            if (!environment) {
              return yield* Effect.fail(new EnvironmentNotFoundError({ id }));
            }
            return environment;
          }),

        createEnvironment: (env: NewEnvironment) =>
          Effect.gen(function* () {
            yield* Effect.try({
              try: () => db.insert(environments).values(env).run(),
              catch: (cause) =>
                new DatabaseError({ message: "Failed to create environment", cause }),
            });

            const results = yield* queryEnvironmentById(env.id);
            const created = results[0];
            if (!created) {
              return yield* Effect.fail(
                new DatabaseError({
                  message: "Environment was created but could not be retrieved",
                }),
              );
            }
            return created;
          }),

        updateEnvironment: (
          id: string,
          updates: Partial<
            Pick<
              Environment,
              | "name"
              | "baseUrl"
              | "username"
              | "version"
              | "icon"
              | "queryConcurrency"
              | "insertConcurrency"
            >
          >,
        ) =>
          Effect.gen(function* () {
            // First check if environment exists
            const existing = yield* queryEnvironmentById(id);
            if (existing.length === 0) {
              return yield* Effect.fail(new EnvironmentNotFoundError({ id }));
            }

            // Update with new timestamp
            const updatedAt = new Date().toISOString();
            yield* Effect.try({
              try: () =>
                db
                  .update(environments)
                  .set({ ...updates, updatedAt })
                  .where(eq(environments.id, id))
                  .run(),
              catch: (cause) =>
                new DatabaseError({ message: "Failed to update environment", cause }),
            });

            // Return updated environment
            const results = yield* queryEnvironmentById(id);
            const updated = results[0];
            if (!updated) {
              return yield* Effect.fail(
                new DatabaseError({
                  message: "Environment was updated but could not be retrieved",
                }),
              );
            }
            return updated;
          }),

        deleteEnvironment: (id: string) =>
          Effect.gen(function* () {
            // First check if environment exists
            const existing = yield* queryEnvironmentById(id);
            if (existing.length === 0) {
              return yield* Effect.fail(new EnvironmentNotFoundError({ id }));
            }

            yield* Effect.try({
              try: () => db.delete(environments).where(eq(environments.id, id)).run(),
              catch: (cause) =>
                new DatabaseError({ message: "Failed to delete environment", cause }),
            });
          }),

        // ---------------------
        // Settings Methods
        // ---------------------

        getSettings: () =>
          Effect.try({
            try: () => {
              const result = db.select().from(settings).where(eq(settings.id, "default")).all();
              return result[0] ?? null;
            },
            catch: (cause) => new DatabaseError({ message: "Failed to fetch settings", cause }),
          }),

        updateSettings: (updates: {
          storePasswords?: boolean;
          masterPasswordHash?: string | null;
        }) =>
          Effect.gen(function* () {
            const now = new Date().toISOString();

            // Check if settings row exists
            const existing = yield* Effect.try({
              try: () => db.select().from(settings).where(eq(settings.id, "default")).all(),
              catch: (cause) => new DatabaseError({ message: "Failed to fetch settings", cause }),
            });

            if (existing.length === 0) {
              // Create default settings row
              yield* Effect.try({
                try: () =>
                  db
                    .insert(settings)
                    .values({
                      id: "default",
                      storePasswords: updates.storePasswords ?? false,
                      masterPasswordHash: updates.masterPasswordHash ?? null,
                      createdAt: now,
                      updatedAt: now,
                    })
                    .run(),
                catch: (cause) =>
                  new DatabaseError({ message: "Failed to create settings", cause }),
              });
            } else {
              // Update existing settings
              yield* Effect.try({
                try: () =>
                  db
                    .update(settings)
                    .set({ ...updates, updatedAt: now })
                    .where(eq(settings.id, "default"))
                    .run(),
                catch: (cause) =>
                  new DatabaseError({ message: "Failed to update settings", cause }),
              });
            }

            // Return updated settings
            const result = yield* Effect.try({
              try: () => db.select().from(settings).where(eq(settings.id, "default")).all(),
              catch: (cause) => new DatabaseError({ message: "Failed to fetch settings", cause }),
            });

            return result[0] as Settings;
          }),

        // ---------------------
        // Encrypted Password Methods
        // ---------------------

        setEncryptedPassword: (envId: string, encryptedPassword: string | null) =>
          Effect.gen(function* () {
            // Check if environment exists
            const existing = yield* queryEnvironmentById(envId);
            if (existing.length === 0) {
              return yield* Effect.fail(new EnvironmentNotFoundError({ id: envId }));
            }

            yield* Effect.try({
              try: () =>
                db
                  .update(environments)
                  .set({ encryptedPassword, updatedAt: new Date().toISOString() })
                  .where(eq(environments.id, envId))
                  .run(),
              catch: (cause) =>
                new DatabaseError({ message: "Failed to set encrypted password", cause }),
            });
          }),

        getEncryptedPassword: (envId: string) =>
          Effect.try({
            try: () => {
              const result = db
                .select({ encryptedPassword: environments.encryptedPassword })
                .from(environments)
                .where(eq(environments.id, envId))
                .all();
              return result[0]?.encryptedPassword ?? null;
            },
            catch: (cause) =>
              new DatabaseError({ message: "Failed to get encrypted password", cause }),
          }),

        clearAllEncryptedPasswords: () =>
          Effect.try({
            try: () =>
              db
                .update(environments)
                .set({ encryptedPassword: null, updatedAt: new Date().toISOString() })
                .run(),
            catch: (cause) =>
              new DatabaseError({ message: "Failed to clear encrypted passwords", cause }),
          }),

        getAllEncryptedPasswords: () =>
          Effect.try({
            try: () =>
              db
                .select({ id: environments.id, encryptedPassword: environments.encryptedPassword })
                .from(environments)
                .all()
                .filter((e) => e.encryptedPassword !== null) as {
                id: string;
                encryptedPassword: string;
              }[],
            catch: (cause) =>
              new DatabaseError({ message: "Failed to get encrypted passwords", cause }),
          }),
      };
    },
  },
) {
  // Static Test layer for testing - can provide mock implementations
  static Test = Layer.succeed(
    this,
    new PersistenceService({
      getEnvironments: () => Effect.succeed([]),
      getEnvironmentById: (id) => Effect.fail(new EnvironmentNotFoundError({ id })),
      createEnvironment: (env) =>
        Effect.succeed({
          ...env,
          createdAt: env.createdAt ?? new Date().toISOString(),
          updatedAt: env.updatedAt ?? new Date().toISOString(),
        } as Environment),
      updateEnvironment: (id) => Effect.fail(new EnvironmentNotFoundError({ id })),
      deleteEnvironment: (id) => Effect.fail(new EnvironmentNotFoundError({ id })),
      // Settings methods
      getSettings: () => Effect.succeed(null),
      updateSettings: () =>
        Effect.succeed({
          id: "default",
          storePasswords: false,
          masterPasswordHash: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      // Encrypted password methods
      setEncryptedPassword: () => Effect.succeed(undefined),
      getEncryptedPassword: () => Effect.succeed(null),
      clearAllEncryptedPasswords: () => Effect.void,
      getAllEncryptedPasswords: () => Effect.succeed([]),
    }),
  );
}

// ---------------------
// Convenience Alias (for backward compatibility)
// ---------------------

// The Layer is now available as PersistenceService.Default
// This alias maintains backward compatibility if needed
export const PersistenceServiceLive = PersistenceService.Default;
