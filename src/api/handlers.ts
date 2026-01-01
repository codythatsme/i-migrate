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
} from "./schemas"
import { PersistenceService, DatabaseError, EnvironmentNotFoundError } from "../services/persistence"
import { SessionService } from "../services/session"
import {
  ImisApiService,
  ImisAuthError,
  ImisRequestError,
  ImisResponseError,
  MissingCredentialsError,
} from "../services/imis-api"
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

const mapPersistenceError = (error: DatabaseError | EnvironmentNotFoundError) => {
  if (error._tag === "DatabaseError") {
    return mapDatabaseError(error)
  }
  return mapEnvironmentNotFoundError(error)
}

const mapConnectionError = (
  error: DatabaseError | EnvironmentNotFoundError | MissingCredentialsError | ImisAuthError | ImisRequestError | ImisResponseError
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
  }
}

// ---------------------
// Helper: Generate UUID
// ---------------------

const generateId = () => crypto.randomUUID()

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

      const now = new Date().toISOString()
      const newEnv: NewEnvironment = {
        id: generateId(),
        name: payload.name,
        baseUrl: payload.baseUrl,
        username: payload.username,
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
      const updates: Partial<{ name: string; baseUrl: string; username: string }> = {}
      if (payload.name !== undefined) updates.name = payload.name
      if (payload.baseUrl !== undefined) updates.baseUrl = payload.baseUrl
      if (payload.username !== undefined) updates.username = payload.username

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
})

