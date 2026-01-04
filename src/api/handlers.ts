import { Effect } from "effect"
import { ApiGroup } from "./procedures"
import {
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  ValidationErrorSchema,
  MissingCredentialsErrorSchema,
  ImisAuthErrorSchema,
  ImisRequestErrorSchema,
  ImisResponseErrorSchema,
  ImisSchemaErrorSchema,
  TraceStoreErrorSchema,
  JobNotFoundErrorSchema,
  JobAlreadyRunningErrorSchema,
  MigrationErrorSchema,
} from "./schemas"
import { PersistenceService, DatabaseError, EnvironmentNotFoundError } from "../services/persistence"
import { SessionService } from "../services/session"
import {
  ImisApiService,
  ImisAuthError,
  ImisRequestError,
  ImisResponseError,
  ImisSchemaError,
  MissingCredentialsError,
} from "../services/imis-api"
import { TraceStoreService, TraceStoreError } from "../services/trace-store"
import {
  MigrationJobService,
  JobNotFoundError,
  JobAlreadyRunningError,
  MigrationError,
} from "../services/migration-job"
import type { NewEnvironment } from "../db/schema"

// ---------------------
// Error Mapping Helpers
// ---------------------

const mapDatabaseError = (error: DatabaseError) =>
  new DatabaseErrorSchema({ message: error.message })

const mapEnvironmentNotFoundError = (error: EnvironmentNotFoundError) =>
  new EnvironmentNotFoundErrorSchema({ id: error.id })

const mapMissingCredentialsError = (error: MissingCredentialsError) =>
  new MissingCredentialsErrorSchema({ environmentId: error.environmentId })

const mapImisAuthError = (error: ImisAuthError) =>
  new ImisAuthErrorSchema({ message: error.message })

const mapImisRequestError = (error: ImisRequestError) =>
  new ImisRequestErrorSchema({ message: error.message })

const mapImisResponseError = (error: ImisResponseError) =>
  new ImisResponseErrorSchema({ message: error.message, status: error.status })

const mapImisSchemaError = (error: ImisSchemaError) =>
  new ImisSchemaErrorSchema({
    message: error.message,
    endpoint: error.endpoint,
    parseError: error.parseError,
  })

const mapTraceStoreError = (error: TraceStoreError) =>
  new TraceStoreErrorSchema({ message: error.message })

const mapJobNotFoundError = (error: JobNotFoundError) =>
  new JobNotFoundErrorSchema({ jobId: error.jobId })

const mapJobAlreadyRunningError = (error: JobAlreadyRunningError) =>
  new JobAlreadyRunningErrorSchema({ jobId: error.jobId })

const mapMigrationError = (error: MigrationError) =>
  new MigrationErrorSchema({ message: error.message })

const mapPersistenceError = (error: DatabaseError | EnvironmentNotFoundError) => {
  if (error._tag === "DatabaseError") {
    return mapDatabaseError(error)
  }
  return mapEnvironmentNotFoundError(error)
}

const mapConnectionError = (
  error: DatabaseError | EnvironmentNotFoundError | MissingCredentialsError | ImisAuthError | ImisRequestError | ImisResponseError | ImisSchemaError
) => {
  switch (error._tag) {
    case "DatabaseError":
      return mapDatabaseError(error)
    case "EnvironmentNotFoundError":
      return mapEnvironmentNotFoundError(error)
    case "MissingCredentialsError":
      return mapMissingCredentialsError(error)
    case "ImisAuthError":
      return mapImisAuthError(error)
    case "ImisRequestError":
      return mapImisRequestError(error)
    case "ImisResponseError":
      return mapImisResponseError(error)
    case "ImisSchemaError":
      return mapImisSchemaError(error)
  }
}

// ---------------------
// Helper: Generate UUID
// ---------------------

const generateId = () => crypto.randomUUID()

// ---------------------
// Helper: Fetch Favicon
// ---------------------

const fetchFavicon = (baseUrl: string): Effect.Effect<string | null, never, never> =>
  Effect.gen(function* () {
    // Parse the URL to get just the origin
    const url = new URL(baseUrl)
    const faviconUrl = `${url.origin}/favicon.ico`

    const response = yield* Effect.tryPromise({
      try: () => fetch(faviconUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { "Accept": "image/x-icon, image/png, image/svg+xml, image/*" }
      }),
      catch: () => null,
    })

    if (!response || !response.ok) {
      return null
    }

    const contentType = response.headers.get("content-type") || "image/x-icon"
    const arrayBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: () => null,
    })

    if (!arrayBuffer) {
      return null
    }

    // Convert to base64 data URL
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    return `data:${contentType};base64,${base64}`
  }).pipe(
    Effect.catchAll(() => Effect.succeed(null))
  )

// ---------------------
// Handlers Implementation
// ---------------------

export const HandlersLive = ApiGroup.toLayer({
  // ---------------------
  // Environment Handlers
  // ---------------------

  "environments.list": () =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService
      const session = yield* SessionService

      const envs = yield* persistence.getEnvironments()

      // Add hasPassword status to each environment
      const envsWithStatus = yield* Effect.all(
        envs.map((env) =>
          Effect.gen(function* () {
            const password = yield* session.getPassword(env.id)
            return { ...env, hasPassword: password !== undefined }
          })
        )
      )

      return envsWithStatus
    }).pipe(Effect.mapError(mapDatabaseError)),

  "environments.get": ({ environmentId }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService
      const session = yield* SessionService

      const env = yield* persistence.getEnvironmentById(environmentId)
      const password = yield* session.getPassword(environmentId)

      return { ...env, hasPassword: password !== undefined }
    }).pipe(Effect.mapError(mapPersistenceError)),

  "environments.create": (payload) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService

      // Validate required fields
      if (!payload.name || !payload.baseUrl || !payload.username) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "Missing required fields: name, baseUrl, username" })
        )
      }

      // Fetch favicon from the base URL (non-blocking, returns null on failure)
      const icon = yield* fetchFavicon(payload.baseUrl)

      const now = new Date().toISOString()
      const newEnv: NewEnvironment = {
        id: generateId(),
        name: payload.name,
        baseUrl: payload.baseUrl,
        username: payload.username,
        icon,
        queryConcurrency: payload.queryConcurrency ?? 5,
        insertConcurrency: payload.insertConcurrency ?? 50,
        createdAt: now,
        updatedAt: now,
      }

      const created = yield* persistence.createEnvironment(newEnv).pipe(
        Effect.mapError(mapDatabaseError)
      )

      return created
    }),

  "environments.update": (payload) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService

      // Build updates object with only defined fields
      const updates: Partial<{
        name: string
        baseUrl: string
        username: string
        queryConcurrency: number
        insertConcurrency: number
      }> = {}
      if (payload.name !== undefined) updates.name = payload.name
      if (payload.baseUrl !== undefined) updates.baseUrl = payload.baseUrl
      if (payload.username !== undefined) updates.username = payload.username
      if (payload.queryConcurrency !== undefined) updates.queryConcurrency = payload.queryConcurrency
      if (payload.insertConcurrency !== undefined) updates.insertConcurrency = payload.insertConcurrency

      if (Object.keys(updates).length === 0) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "No valid fields to update" })
        )
      }

      const updated = yield* persistence.updateEnvironment(payload.id, updates).pipe(
        Effect.mapError(mapPersistenceError)
      )

      return updated
    }),

  "environments.delete": ({ environmentId }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService
      const session = yield* SessionService

      // Clear session data when environment is deleted
      yield* session.clearSession(environmentId)
      yield* persistence.deleteEnvironment(environmentId).pipe(
        Effect.mapError(mapPersistenceError)
      )
    }),

  // ---------------------
  // Password Handlers
  // ---------------------

  "password.set": ({ environmentId, password }) =>
    Effect.gen(function* () {
      const persistence = yield* PersistenceService
      const session = yield* SessionService

      // Verify environment exists first
      yield* persistence.getEnvironmentById(environmentId).pipe(
        Effect.mapError(mapPersistenceError)
      )

      // Store password in server-side memory
      yield* session.setPassword(environmentId, password)
    }),

  "password.clear": ({ environmentId }) =>
    Effect.gen(function* () {
      const session = yield* SessionService
      yield* session.clearPassword(environmentId)
    }),

  "password.status": ({ environmentId }) =>
    Effect.gen(function* () {
      const session = yield* SessionService
      const password = yield* session.getPassword(environmentId)
      return { hasPassword: password !== undefined }
    }),

  // ---------------------
  // Connection Test Handler
  // ---------------------

  "connection.test": ({ environmentId }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService
      const result = yield* imisApi.healthCheck(environmentId)
      return result
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Data Sources Handler
  // ---------------------

  "datasources.list": ({ environmentId, limit }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService
      const result = yield* imisApi.getBoEntityDefinitions(environmentId, limit ?? 500)
      return result
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Document Handlers
  // ---------------------

  "documents.byPath": ({ environmentId, path }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService
      const result = yield* imisApi.getDocumentByPath(environmentId, path)
      return result
    }).pipe(Effect.mapError(mapConnectionError)),

  "documents.inFolder": ({ environmentId, folderId, fileTypes }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService
      const result = yield* imisApi.getDocumentsInFolder(environmentId, folderId, [...fileTypes])
      return result
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Query Definition Handler
  // ---------------------

  "queries.definition": ({ environmentId, path }) =>
    Effect.gen(function* () {
      const imisApi = yield* ImisApiService
      const result = yield* imisApi.getQueryDefinition(environmentId, path)
      return result
    }).pipe(Effect.mapError(mapConnectionError)),

  // ---------------------
  // Trace Handlers
  // ---------------------

  "traces.list": ({ limit, offset }) =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService
      const traces = yield* traceStore.listTraces(limit ?? 50, offset ?? 0)
      return traces
    }).pipe(Effect.mapError(mapTraceStoreError)),

  "traces.get": ({ traceId }) =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService
      const trace = yield* traceStore.getTrace(traceId)
      return trace
    }).pipe(Effect.mapError(mapTraceStoreError)),

  "traces.clear": () =>
    Effect.gen(function* () {
      const traceStore = yield* TraceStoreService
      yield* traceStore.clearTraces()
    }).pipe(Effect.mapError(mapTraceStoreError)),

  // ---------------------
  // Job Handlers
  // ---------------------

  "jobs.create": (payload) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      
      // Validate required fields based on mode
      if (!payload.name) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "Job name is required" })
        )
      }
      if (payload.mode === "query" && !payload.sourceQueryPath) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "Source query path is required for query mode" })
        )
      }
      if (payload.mode === "datasource" && !payload.sourceEntityType) {
        return yield* Effect.fail(
          new ValidationErrorSchema({ message: "Source entity type is required for datasource mode" })
        )
      }

      const result = yield* jobService.createJob({
        name: payload.name,
        mode: payload.mode,
        sourceEnvironmentId: payload.sourceEnvironmentId,
        sourceQueryPath: payload.sourceQueryPath,
        sourceEntityType: payload.sourceEntityType,
        destEnvironmentId: payload.destEnvironmentId,
        destEntityType: payload.destEntityType,
        mappings: [...payload.mappings],
      })
      
      return result
    }).pipe(
      Effect.mapError((error) => {
        if (error instanceof ValidationErrorSchema) return error
        if (error._tag === "DatabaseError") return mapDatabaseError(error)
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }))
      })
    ),

  "jobs.list": () =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      const persistence = yield* PersistenceService
      const jobs = yield* jobService.listJobs()

      // Add environment names to each job
      const jobsWithEnvs = yield* Effect.all(
        jobs.map((job) =>
          Effect.gen(function* () {
            const sourceEnv = yield* persistence.getEnvironmentById(job.sourceEnvironmentId).pipe(
              Effect.catchAll(() => Effect.succeed({ name: "Unknown" }))
            )
            const destEnv = yield* persistence.getEnvironmentById(job.destEnvironmentId).pipe(
              Effect.catchAll(() => Effect.succeed({ name: "Unknown" }))
            )
            return {
              ...job,
              sourceEnvironmentName: sourceEnv.name,
              destEnvironmentName: destEnv.name,
            }
          })
        )
      )

      return jobsWithEnvs
    }).pipe(Effect.mapError(mapDatabaseError)),

  "jobs.get": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      const persistence = yield* PersistenceService
      const job = yield* jobService.getJob(jobId)

      // Add environment names
      const sourceEnv = yield* persistence.getEnvironmentById(job.sourceEnvironmentId).pipe(
        Effect.catchAll(() => Effect.succeed({ name: "Unknown" }))
      )
      const destEnv = yield* persistence.getEnvironmentById(job.destEnvironmentId).pipe(
        Effect.catchAll(() => Effect.succeed({ name: "Unknown" }))
      )

      return {
        ...job,
        sourceEnvironmentName: sourceEnv.name,
        destEnvironmentName: destEnv.name,
      }
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error)
        if (error._tag === "DatabaseError") return mapDatabaseError(error)
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }))
      })
    ),

  "jobs.run": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      const result = yield* jobService.runJob(jobId)
      return result
    }).pipe(
      Effect.mapError((error) => {
        switch (error._tag) {
          case "JobNotFoundError":
            return mapJobNotFoundError(error)
          case "JobAlreadyRunningError":
            return mapJobAlreadyRunningError(error)
          case "MigrationError":
            return mapMigrationError(error)
          case "DatabaseError":
            return mapDatabaseError(error)
          case "EnvironmentNotFoundError":
            return mapEnvironmentNotFoundError(error)
          case "MissingCredentialsError":
            return mapMissingCredentialsError(error)
          case "ImisAuthError":
            return mapImisAuthError(error)
          case "ImisRequestError":
            return mapImisRequestError(error)
          case "ImisResponseError":
            return mapImisResponseError(error)
          case "ImisSchemaError":
            return mapImisSchemaError(error)
          default:
            return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }))
        }
      })
    ),

  "jobs.retry": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      const result = yield* jobService.retryFailedRows(jobId)
      return result
    }).pipe(
      Effect.mapError((error) => {
        switch (error._tag) {
          case "JobNotFoundError":
            return mapJobNotFoundError(error)
          case "DatabaseError":
            return mapDatabaseError(error)
          case "EnvironmentNotFoundError":
            return mapEnvironmentNotFoundError(error)
          case "MissingCredentialsError":
            return mapMissingCredentialsError(error)
        }
      })
    ),

  "jobs.failedRows": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      const failedRows = yield* jobService.getJobFailedRows(jobId)
      return failedRows
    }).pipe(Effect.mapError(mapDatabaseError)),

  "jobs.cancel": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      yield* jobService.cancelJob(jobId)
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error)
        if (error._tag === "DatabaseError") return mapDatabaseError(error)
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }))
      })
    ),

  "jobs.delete": ({ jobId }) =>
    Effect.gen(function* () {
      const jobService = yield* MigrationJobService
      yield* jobService.deleteJob(jobId)
    }).pipe(
      Effect.mapError((error) => {
        if (error._tag === "JobNotFoundError") return mapJobNotFoundError(error)
        if (error._tag === "DatabaseError") return mapDatabaseError(error)
        return mapDatabaseError(new DatabaseError({ message: "Unknown error", cause: error }))
      })
    ),
})

