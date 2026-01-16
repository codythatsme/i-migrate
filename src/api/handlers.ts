import { Effect } from "effect";
import { ApiGroup } from "./procedures";
import {
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  ValidationErrorSchema,
  MissingCredentialsErrorSchema,
  ImisAuthErrorSchema,
  ImisRequestErrorSchema,
  ImisResponseErrorSchema,
  ImisSchemaErrorSchema,
  InvalidCredentialsErrorSchema,
  NotStaffAccountErrorSchema,
  TraceStoreErrorSchema,
  JobNotFoundErrorSchema,
  JobAlreadyRunningErrorSchema,
  InvalidMasterPasswordErrorSchema,
} from "./schemas";
import {
  hashPassword,
  verifyPassword,
  deriveMasterKey,
  encryptWithKey,
  decryptWithKey,
} from "../lib/encryption";
import {
  PersistenceService,
  DatabaseError,
  EnvironmentNotFoundError,
} from "../services/persistence";
import { SessionService } from "../services/session";
import {
  ImisApiService,
  ImisAuthError,
  ImisRequestError,
  ImisResponseError,
  ImisSchemaError,
  MissingCredentialsError,
  InvalidCredentialsError,
  NotStaffAccountError,
} from "../services/imis-api";
import { TraceStoreService, TraceStoreError } from "../services/trace-store";
import {
  MigrationJobService,
  JobNotFoundError,
  JobAlreadyRunningError,
} from "../services/migration-job";
import type { NewEnvironment } from "../db/schema";

// ---------------------
// Error Mapping Helpers
// ---------------------

const mapDatabaseError = (error: DatabaseError) =>
  new DatabaseErrorSchema({ message: error.message });

const mapEnvironmentNotFoundError = (error: EnvironmentNotFoundError) =>
  new EnvironmentNotFoundErrorSchema({ id: error.id });

const mapMissingCredentialsError = (error: MissingCredentialsError) =>
  new MissingCredentialsErrorSchema({
    environmentId: error.environmentId,
    message: "Password is required. Please enter your password first.",
  });

const mapImisAuthError = (error: ImisAuthError) => {
  const cause = error.cause as { status?: number; body?: string } | undefined;
  return new ImisAuthErrorSchema({
    message: error.message,
    statusCode: cause?.status,
    responseBody: cause?.body,
  });
};

const mapImisRequestError = (error: ImisRequestError) => {
  const cause = error.cause as { status?: number; body?: string } | undefined;
  return new ImisRequestErrorSchema({
    message: error.message,
    statusCode: cause?.status,
    responseBody: cause?.body,
  });
};

const mapImisResponseError = (error: ImisResponseError) =>
  new ImisResponseErrorSchema({
    message: error.message,
    status: error.status,
    responseBody: error.body,
  });

const mapImisSchemaError = (error: ImisSchemaError) =>
  new ImisSchemaErrorSchema({
    message: error.message,
    endpoint: error.endpoint,
    parseError: error.parseError,
  });

const mapTraceStoreError = (error: TraceStoreError) =>
  new TraceStoreErrorSchema({ message: error.message });

const mapJobNotFoundError = (error: JobNotFoundError) =>
  new JobNotFoundErrorSchema({ jobId: error.jobId });

const mapJobAlreadyRunningError = (error: JobAlreadyRunningError) =>
  new JobAlreadyRunningErrorSchema({ jobId: error.jobId });

const mapInvalidCredentialsError = (error: InvalidCredentialsError) => {
  const cause = error.cause as { status?: number; body?: string } | undefined;
  return new InvalidCredentialsErrorSchema({
    message: error.message,
    statusCode: cause?.status,
    responseBody: cause?.body,
  });
};

const mapNotStaffAccountError = (error: NotStaffAccountError) =>
  new NotStaffAccountErrorSchema({ username: error.username, message: error.message });

const mapCredentialValidationError = (
  error:
    | DatabaseError
    | EnvironmentNotFoundError
    | InvalidCredentialsError
    | NotStaffAccountError
    | ImisRequestError
    | ImisResponseError,
) => {
  switch (error._tag) {
    case "DatabaseError":
      return mapDatabaseError(error);
    case "EnvironmentNotFoundError":
      return mapEnvironmentNotFoundError(error);
    case "InvalidCredentialsError":
      return mapInvalidCredentialsError(error);
    case "NotStaffAccountError":
      return mapNotStaffAccountError(error);
    case "ImisRequestError":
      return mapImisRequestError(error);
    case "ImisResponseError":
      return mapImisResponseError(error);
  }
};

const mapPersistenceError = (error: DatabaseError | EnvironmentNotFoundError) => {
  if (error._tag === "DatabaseError") {
    return mapDatabaseError(error);
  }
  return mapEnvironmentNotFoundError(error);
};

const mapConnectionError = (
  error:
    | DatabaseError
    | EnvironmentNotFoundError
    | MissingCredentialsError
    | ImisAuthError
    | ImisRequestError
    | ImisResponseError
    | ImisSchemaError,
) => {
  switch (error._tag) {
    case "DatabaseError":
      return mapDatabaseError(error);
    case "EnvironmentNotFoundError":
      return mapEnvironmentNotFoundError(error);
    case "MissingCredentialsError":
      return mapMissingCredentialsError(error);
    case "ImisAuthError":
      return mapImisAuthError(error);
    case "ImisRequestError":
      return mapImisRequestError(error);
    case "ImisResponseError":
      return mapImisResponseError(error);
    case "ImisSchemaError":
      return mapImisSchemaError(error);
  }
};

// ---------------------
// Helper: Generate UUID
// ---------------------

const generateId = () => crypto.randomUUID();

// ---------------------
// Helper: Fetch Favicon
// ---------------------

const fetchFavicon = (baseUrl: string): Effect.Effect<string | null, never, never> =>
  Effect.gen(function* () {
    // Parse the URL to get just the origin
    const url = new URL(baseUrl);
    const faviconUrl = `${url.origin}/favicon.ico`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(faviconUrl, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "image/x-icon, image/png, image/svg+xml, image/*" },
        }),
      catch: () => null,
    });

    if (!response || !response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/x-icon";
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: () => null,
    });

    if (!arrayBuffer) {
      return null;
    }

    // Convert to base64 data URL
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  }).pipe(Effect.catchAll(() => Effect.succeed(null)));

// ---------------------
// Handlers Implementation
// ---------------------

export const HandlersLive = ApiGroup.toLayer({
  // ---------------------
  // Environment Handlers
  // ---------------------

  "environments.list": () =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      const envs = yield* persistence.getEnvironments();

      // Add hasPassword status to each environment
      const envsWithStatus = yield* Effect.all(
        envs.map((env) =>
          Effect.gen(function* () {
            const password = yield* session.getPassword(env.id);
            return { ...env, hasPassword: password !== undefined };
          }),
        ),
      );

      return envsWithStatus;
    }).pipe(Effect.mapError(mapDatabaseError)),

  "environments.get": ({ environmentId }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      const env = yield* persistence.getEnvironmentById(environmentId);
      const password = yield* session.getPassword(environmentId);

      return { ...env, hasPassword: password !== undefined };
    }).pipe(Effect.mapError(mapPersistenceError)),

  "environments.create": (payload) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;

      // Validate required fields
      if (!payload.name || !payload.baseUrl || !payload.username) {
        return yield* Effect.fail(
          new ValidationErrorSchema({
            message: "Missing required fields: name, baseUrl, username",
          }),
        );
      }

      // Fetch favicon from the base URL (non-blocking, returns null on failure)
      const icon = yield* fetchFavicon(payload.baseUrl);

      const now = new Date().toISOString();
      const newEnv: NewEnvironment = {
        id: generateId(),
        name: payload.name,
        baseUrl: payload.baseUrl,
        username: payload.username,
        version: payload.version ?? "EMS",
        icon,
        queryConcurrency: payload.queryConcurrency ?? 5,
        insertConcurrency: payload.insertConcurrency ?? 50,
        createdAt: now,
        updatedAt: now,
      };

      const created = yield* persistence
        .createEnvironment(newEnv)
        .pipe(Effect.mapError(mapDatabaseError));

      return created;
    }),

  "environments.update": (payload) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;

      // Build updates object with only defined fields
      const updates: Partial<{
        name: string;
        baseUrl: string;
        username: string;
        version: "EMS" | "2017";
        queryConcurrency: number;
        insertConcurrency: number;
      }> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.baseUrl !== undefined) updates.baseUrl = payload.baseUrl;
      if (payload.username !== undefined) updates.username = payload.username;
      if (payload.version !== undefined) updates.version = payload.version;
      if (payload.queryConcurrency !== undefined)
        updates.queryConcurrency = payload.queryConcurrency;
      if (payload.insertConcurrency !== undefined)
        updates.insertConcurrency = payload.insertConcurrency;

      if (Object.keys(updates).length === 0) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "No valid fields to update" }),
        );
      }

      const updated = yield* persistence
        .updateEnvironment(payload.id, updates)
        .pipe(Effect.mapError(mapPersistenceError));

      return updated;
    }),

  "environments.delete": ({ environmentId }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      // Clear session data when environment is deleted
      yield* session.clearSession(environmentId);
      yield* persistence
        .deleteEnvironment(environmentId)
        .pipe(Effect.mapError(mapPersistenceError));
    }),

  // ---------------------
  // Password Handlers
  // ---------------------

  "password.set": ({ environmentId, password }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;
      const imisApi = yield* ImisApiService;

      // Verify environment exists first
      yield* persistence
        .getEnvironmentById(environmentId)
        .pipe(Effect.mapError(mapPersistenceError));

      // Validate credentials and check staff role before storing
      yield* imisApi
        .validateCredentials(environmentId, password)
        .pipe(Effect.mapError(mapCredentialValidationError));

      // Store password in server-side memory (only after validation succeeds)
      yield* session.setPassword(environmentId, password);

      // If password storage is enabled, also encrypt and store in DB
      const dbSettings = yield* persistence.getSettings();
      if (dbSettings?.storePasswords) {
        const masterPw = (yield* session.getMasterPassword()) as {
          password: string;
          derivedKey: CryptoKey;
        } | null;
        if (masterPw !== null) {
          const encrypted = yield* Effect.promise(() =>
            encryptWithKey(password, masterPw.derivedKey),
          );
          yield* persistence.setEncryptedPassword(environmentId, encrypted);
        }
      }
    }),

  "password.clear": ({ environmentId }) =>
    Effect.gen(function* () {
      const session = yield* SessionService;
      const persistence = yield* PersistenceService;
      yield* session.clearPassword(environmentId);
      // Also clear from database if stored (ignore errors - best effort)
      yield* persistence.setEncryptedPassword(environmentId, null).pipe(Effect.ignore);
    }),

  "password.status": ({ environmentId }) =>
    Effect.gen(function* () {
      const session = yield* SessionService;
      const password = yield* session.getPassword(environmentId);
      return { hasPassword: password !== undefined };
    }),

  // ---------------------
  // Connection Test Handler
  // ---------------------

  "connection.test": ({ environmentId }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const result = yield* imisApi.healthCheck(environmentId);
      return result;
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Data Sources Handler
  // ---------------------

  "datasources.list": ({ environmentId, limit }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const result = yield* imisApi.getBoEntityDefinitions(environmentId, limit ?? 500);
      return result;
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Document Handlers
  // ---------------------

  "documents.byPath": ({ environmentId, path }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const result = yield* imisApi.getDocumentByPath(environmentId, path);
      return result;
    }).pipe(Effect.mapError(mapConnectionError)),

  "documents.inFolder": ({ environmentId, folderId, fileTypes }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const result = yield* imisApi.getDocumentsInFolder(environmentId, folderId, [...fileTypes]);
      return result;
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Query Definition Handler
  // ---------------------

  "queries.definition": ({ environmentId, path }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService;
      const result = yield* imisApi.getQueryDefinition(environmentId, path);
      return result;
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Trace Handlers
  // ---------------------

  "traces.list": ({ limit, offset }) =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService;
      const traces = yield* traceStore.listTraces(limit ?? 50, offset ?? 0);
      return traces;
    }).pipe(Effect.mapError(mapTraceStoreError)),

  "traces.get": ({ traceId }) =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService;
      const trace = yield* traceStore.getTrace(traceId);
      return trace;
    }).pipe(Effect.mapError(mapTraceStoreError)),

  "traces.clear": () =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService;
      yield* traceStore.clearTraces();
    }).pipe(Effect.mapError(mapTraceStoreError)),

  "traces.export": () =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService;
      // Get all trace summaries (use high limit to get all)
      const summaries = yield* traceStore.listTraces(10000, 0);
      // Fetch full trace data for each
      const traces = yield* Effect.all(
        summaries.map((summary) => traceStore.getTrace(summary.id)),
        { concurrency: 10 },
      );
      // Filter out any null results
      return traces.filter((t): t is NonNullable<typeof t> => t !== null);
    }).pipe(Effect.mapError(mapTraceStoreError)),

  // ---------------------
  // Job Handlers
  // ---------------------

  "jobs.create": (payload) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;

      // Validate required fields based on mode
      if (!payload.name) {
        return yield* Effect.fail(new ValidationErrorSchema({ message: "Job name is required" }));
      }
      if (payload.mode === "query" && !payload.sourceQueryPath) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "Source query path is required for query mode" }),
        );
      }
      if (payload.mode === "datasource" && !payload.sourceEntityType) {
        return yield* Effect.fail(
          new ValidationErrorSchema({
            message: "Source entity type is required for datasource mode",
          }),
        );
      }

      const result = yield* jobService.createJob({
        name: payload.name,
        mode: payload.mode,
        sourceEnvironmentId: payload.sourceEnvironmentId,
        sourceQueryPath: payload.sourceQueryPath,
        sourceEntityType: payload.sourceEntityType,
        destEnvironmentId: payload.destEnvironmentId,
        destEntityType: payload.destEntityType,
        destType: payload.destType ?? "bo_entity",
        mappings: [...payload.mappings],
      });

      // Fork job to run in the background (completely independent of HTTP request)
      // Using forkDaemon ensures the job continues even after the request completes
      yield* Effect.forkDaemon(
        jobService.runJob(result.jobId).pipe(
          Effect.catchAllCause((cause) => {
            console.error(`[MigrationJob] Background job ${result.jobId} failed:`, cause);
            return Effect.void;
          }),
        ),
      );

      return result;
    }).pipe(
      Effect.mapError((error) => {
        if (error instanceof ValidationErrorSchema) return error;
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "jobs.list": () =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      const persistence = yield* PersistenceService;
      const jobs = yield* jobService.listJobsWithCounts();

      // Add environment names to each job
      const jobsWithEnvs = yield* Effect.all(
        jobs.map((job) =>
          Effect.gen(function* () {
            const sourceEnv = yield* persistence
              .getEnvironmentById(job.sourceEnvironmentId)
              .pipe(Effect.catchAll(() => Effect.succeed({ name: "Unknown" })));
            const destEnv = yield* persistence
              .getEnvironmentById(job.destEnvironmentId)
              .pipe(Effect.catchAll(() => Effect.succeed({ name: "Unknown" })));
            return {
              ...job,
              sourceEnvironmentName: sourceEnv.name,
              destEnvironmentName: destEnv.name,
            };
          }),
        ),
      );

      return jobsWithEnvs;
    }).pipe(Effect.mapError(mapDatabaseError)),

  "jobs.get": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      const persistence = yield* PersistenceService;
      const job = yield* jobService.getJobWithCounts(jobId);

      // Add environment names
      const sourceEnv = yield* persistence
        .getEnvironmentById(job.sourceEnvironmentId)
        .pipe(Effect.catchAll(() => Effect.succeed({ name: "Unknown" })));
      const destEnv = yield* persistence
        .getEnvironmentById(job.destEnvironmentId)
        .pipe(Effect.catchAll(() => Effect.succeed({ name: "Unknown" })));

      return {
        ...job,
        sourceEnvironmentName: sourceEnv.name,
        destEnvironmentName: destEnv.name,
      };
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error);
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "jobs.run": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;

      // Verify job exists and is in a runnable state (will throw if not found or already running)
      const job = yield* jobService.getJob(jobId);
      if (job.status !== "queued" && job.status !== "failed" && job.status !== "partial") {
        return yield* Effect.fail(new JobAlreadyRunningError({ jobId }));
      }

      // Fork job to run in the background (completely independent of HTTP request)
      yield* Effect.forkDaemon(
        jobService.runJob(jobId).pipe(
          Effect.catchAllCause((cause) => {
            console.error(`[MigrationJob] Background job ${jobId} failed:`, cause);
            return Effect.void;
          }),
        ),
      );

      return { started: true };
    }).pipe(
      Effect.mapError((error) => {
        switch (error._tag) {
          case "JobNotFoundError":
            return mapJobNotFoundError(error);
          case "JobAlreadyRunningError":
            return mapJobAlreadyRunningError(error);
          case "DatabaseError":
            return mapDatabaseError(error);
        }
      }),
    ),

  "jobs.retry": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      const result = yield* jobService.retryFailedRows(jobId);
      return result;
    }).pipe(
      Effect.mapError((error) => {
        switch (error._tag) {
          case "JobNotFoundError":
            return mapJobNotFoundError(error);
          case "DatabaseError":
            return mapDatabaseError(error);
          case "EnvironmentNotFoundError":
            return mapEnvironmentNotFoundError(error);
          case "MissingCredentialsError":
            return mapMissingCredentialsError(error);
        }
      }),
    ),

  "jobs.rows": ({ jobId, status }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      const result = yield* jobService.getJobRows(jobId, { status });
      return result;
    }).pipe(Effect.mapError(mapDatabaseError)),

  "rows.attempts": ({ rowId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      const attempts = yield* jobService.getRowAttempts(rowId);
      return attempts;
    }).pipe(Effect.mapError(mapDatabaseError)),

  "jobs.retrySingleRow": ({ rowId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      return yield* jobService.retrySingleRow(rowId);
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error);
        if (error._tag === "MissingCredentialsError") return mapMissingCredentialsError(error);
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "jobs.cancel": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      yield* jobService.cancelJob(jobId);
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error);
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "jobs.delete": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService;
      yield* jobService.deleteJob(jobId);
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error);
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  // ---------------------
  // Settings Handlers
  // ---------------------

  "settings.get": () =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      const dbSettings = yield* persistence.getSettings();
      const isUnlocked = yield* session.isMasterPasswordSet();

      return {
        storePasswords: dbSettings?.storePasswords ?? false,
        hasMasterPassword:
          dbSettings?.masterPasswordHash !== null && dbSettings?.masterPasswordHash !== undefined,
        isUnlocked,
        verboseLogging: dbSettings?.verboseLogging ?? false,
      };
    }).pipe(Effect.mapError(mapDatabaseError)),

  "settings.enableStorage": ({ masterPassword }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      // Hash the master password for verification
      const masterPasswordHash = yield* Effect.promise(() => hashPassword(masterPassword));

      // Derive the encryption key
      const derivedKey = yield* Effect.promise(() => deriveMasterKey(masterPassword));

      // Store master password in memory
      yield* session.setMasterPassword(masterPassword, derivedKey);

      // Update settings
      yield* persistence.updateSettings({
        storePasswords: true,
        masterPasswordHash,
      });

      // Auto-save any currently in-memory passwords
      const environments = yield* persistence.getEnvironments();
      for (const env of environments) {
        const password = yield* session.getPassword(env.id);
        if (password) {
          const encrypted = yield* Effect.promise(() => encryptWithKey(password, derivedKey));
          // Ignore EnvironmentNotFoundError since we just fetched these environments
          yield* persistence.setEncryptedPassword(env.id, encrypted).pipe(Effect.ignore);
        }
      }

      return {
        storePasswords: true,
        hasMasterPassword: true,
        isUnlocked: true,
        verboseLogging: false,
      };
    }).pipe(Effect.mapError(mapDatabaseError)),

  "settings.disableStorage": () =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      // Clear all encrypted passwords
      yield* persistence.clearAllEncryptedPasswords();

      // Clear master password from memory
      yield* session.clearMasterPassword();

      // Update settings
      yield* persistence.updateSettings({
        storePasswords: false,
        masterPasswordHash: null,
      });

      return {
        storePasswords: false,
        hasMasterPassword: false,
        isUnlocked: false,
        verboseLogging: false,
      };
    }).pipe(Effect.mapError(mapDatabaseError)),

  "settings.verifyMasterPassword": ({ masterPassword }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      const dbSettings = yield* persistence.getSettings();

      if (!dbSettings?.masterPasswordHash) {
        return yield* Effect.fail(
          new InvalidMasterPasswordErrorSchema({ message: "No master password configured" }),
        );
      }

      // Verify the password
      const isValid = yield* Effect.promise(() =>
        verifyPassword(masterPassword, dbSettings.masterPasswordHash!),
      );

      if (!isValid) {
        return yield* Effect.fail(
          new InvalidMasterPasswordErrorSchema({ message: "Invalid master password" }),
        );
      }

      // Derive the encryption key and store in session
      const derivedKey = yield* Effect.promise(() => deriveMasterKey(masterPassword));
      yield* session.setMasterPassword(masterPassword, derivedKey);

      // Load all encrypted passwords into memory
      const encryptedPasswords = yield* persistence.getAllEncryptedPasswords();
      for (const { id, encryptedPassword } of encryptedPasswords) {
        const decrypted = yield* Effect.promise(() =>
          decryptWithKey(encryptedPassword, derivedKey),
        ).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (decrypted) {
          yield* session.setPassword(id, decrypted);
        }
      }

      return true;
    }).pipe(
      Effect.mapError((error) => {
        if (error instanceof InvalidMasterPasswordErrorSchema) return error;
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "settings.changeMasterPassword": ({ currentPassword, newPassword }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      const session = yield* SessionService;

      const dbSettings = yield* persistence.getSettings();

      if (!dbSettings?.masterPasswordHash) {
        return yield* Effect.fail(
          new InvalidMasterPasswordErrorSchema({ message: "No master password configured" }),
        );
      }

      // Verify current password
      const isValid = yield* Effect.promise(() =>
        verifyPassword(currentPassword, dbSettings.masterPasswordHash!),
      );

      if (!isValid) {
        return yield* Effect.fail(
          new InvalidMasterPasswordErrorSchema({ message: "Current password is incorrect" }),
        );
      }

      // Derive old and new keys
      const oldKey = yield* Effect.promise(() => deriveMasterKey(currentPassword));
      const newKey = yield* Effect.promise(() => deriveMasterKey(newPassword));
      const newHash = yield* Effect.promise(() => hashPassword(newPassword));

      // Re-encrypt all stored passwords
      const encryptedPasswords = yield* persistence.getAllEncryptedPasswords();
      for (const { id, encryptedPassword } of encryptedPasswords) {
        // Decrypt with old key
        const decrypted = yield* Effect.promise(() =>
          decryptWithKey(encryptedPassword, oldKey),
        ).pipe(Effect.catchAll(() => Effect.succeed(null)));

        if (decrypted) {
          // Re-encrypt with new key
          const reEncrypted = yield* Effect.promise(() => encryptWithKey(decrypted, newKey));
          yield* persistence.setEncryptedPassword(id, reEncrypted);
        }
      }

      // Update the stored hash
      yield* persistence.updateSettings({ masterPasswordHash: newHash });

      // Update session with new master password
      yield* session.setMasterPassword(newPassword, newKey);
    }).pipe(
      Effect.mapError((error) => {
        if (error instanceof InvalidMasterPasswordErrorSchema) return error;
        if (error._tag === "DatabaseError") return mapDatabaseError(error);
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }));
      }),
    ),

  "settings.lock": () =>
    Effect.gen(function* () {
      const session = yield* SessionService;
      yield* session.clearMasterPassword();
    }),

  "settings.setVerboseLogging": ({ verboseLogging }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService;
      yield* persistence.updateSettings({ verboseLogging });
    }).pipe(Effect.mapError(mapDatabaseError)),
});
