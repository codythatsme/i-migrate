import { Effect, Layer, Data, Schema, ParseResult, Schedule, Duration } from "effect"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { SessionService } from "./session"
import { PersistenceService, EnvironmentNotFoundError, DatabaseError } from "./persistence"
import {
  BoEntityDefinitionQueryResponseSchema,
  DocumentSummaryResultSchema,
  DocumentSummaryCollectionResultSchema,
  QueryDefinitionResultSchema,
  IqaQueryResponseSchema,
  Iqa2017ResponseSchema,
  GenericEntityDataSchema,
  type QueryResponse,
  type BoEntityDefinition,
  type DocumentSummaryResult,
  type DocumentSummaryCollectionResult,
  type QueryDefinitionResult,
  type IqaQueryResponse,
  type Iqa2017Response,
  type GenericEntityData,
} from "../api/imis-schemas"

// ---------------------
// Domain Errors
// ---------------------

export class ImisAuthError extends Data.TaggedError("ImisAuthError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ImisRequestError extends Data.TaggedError("ImisRequestError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export class ImisResponseError extends Data.TaggedError("ImisResponseError")<{
  readonly message: string
  readonly status: number
  readonly cause?: unknown
}> {}

export class ImisSchemaError extends Data.TaggedError("ImisSchemaError")<{
  readonly message: string
  readonly endpoint: string
  readonly parseError: string
  readonly cause?: unknown
}> {}

export class MissingCredentialsError extends Data.TaggedError("MissingCredentialsError")<{
  readonly environmentId: string
}> {
  override get message() {
    return `Password not set for environment: ${this.environmentId}`
  }
}

// ---------------------
// Retry Configuration
// ---------------------

// Retry schedule: exponential backoff starting at 500ms, factor of 2, up to 3 retries
// This gives delays of: 500ms, 1000ms, 2000ms
const transientRetrySchedule = Schedule.exponential(Duration.millis(500), 2).pipe(
  Schedule.intersect(Schedule.recurs(3))
)

// Determines if an HTTP error is transient (worth retrying)
const isTransientHttpError = (error: unknown): boolean => {
  if (HttpClientError.isHttpClientError(error)) {
    // Network/connection errors are transient
    if (error._tag === "RequestError") {
      return true
    }
    // 5xx server errors and 429 (rate limit) are transient
    if (error._tag === "ResponseError") {
      const status = error.response.status
      return status >= 500 || status === 429
    }
  }
  return false
}

// ---------------------
// Error Detection Helpers
// ---------------------

const isParseError = (error: unknown): error is ParseResult.ParseError =>
  error instanceof Error && error.name === "ParseError"

const formatParseError = (error: ParseResult.ParseError): string => {
  try {
    return ParseResult.TreeFormatter.formatErrorSync(error)
  } catch {
    return error.message
  }
}

// ---------------------
// 2017 IQA Response Normalization
// ---------------------

/**
 * Unwrap values that are wrapped in { $type, $value } objects.
 * For example: { "$type": "System.Int32", "$value": 13280 } -> 13280
 * Preserves blob structure for binary data.
 */
const unwrapValue = (value: unknown): unknown => {
  if (typeof value === "object" && value !== null && "$value" in value) {
    const wrapped = value as { $type: string; $value: unknown }
    // Preserve blob structure for binary data
    if (wrapped.$type === "System.Byte[], mscorlib") {
      return value
    }
    return wrapped.$value
  }
  return value
}

/**
 * Normalize a 2017 IQA response to match the EMS format.
 * Converts GenericEntityData rows with Properties array to flat Record<string, unknown>.
 */
const normalize2017Response = (response: Iqa2017Response): IqaQueryResponse => ({
  ...response,
  Items: {
    ...response.Items,
    $values: response.Items.$values.map((row) =>
      Object.fromEntries(
        row.Properties.$values.map((p) => [p.Name, unwrapValue(p.Value)])
      )
    ),
  },
})

// ---------------------
// Schemas
// ---------------------

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Number,
})

type TokenResponse = typeof TokenResponse.Type

// ---------------------
// Service Definition
// ---------------------

export class ImisApiService extends Effect.Service<ImisApiService>()("app/ImisApiService", {
  accessors: true,

  effect: Effect.gen(function* () {
    const session = yield* SessionService
    const persistence = yield* PersistenceService
    const httpClient = yield* HttpClient.HttpClient

    // ---------------------
    // Internal Helpers
    // ---------------------

    // Fetch a new token from IMIS /token endpoint
    const fetchToken = (envId: string) =>
      Effect.gen(function* () {
        // Get environment config
        const env = yield* persistence.getEnvironmentById(envId)

        // Get password from session
        const password = yield* session.getPassword(envId)
        if (!password) {
          return yield* Effect.fail(new MissingCredentialsError({ environmentId: envId }))
        }

        // Build token request
        const tokenUrl = `${env.baseUrl}/token`
        const body = new URLSearchParams({
          grant_type: "password",
          username: env.username,
          password: password,
        })

        // Make token request with retry for transient errors
        const response = yield* HttpClientRequest.post(tokenUrl).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/x-www-form-urlencoded"),
          HttpClientRequest.setHeader("Accept", "application/json"),
          HttpClientRequest.bodyText(body.toString(), "application/x-www-form-urlencoded"),
          httpClient.execute,
          Effect.flatMap((res) =>
            res.status >= 200 && res.status < 300
              ? Effect.succeed(res)
              : Effect.fail(
                  new ImisAuthError({
                    message: `Authentication failed with status ${res.status}`,
                  })
                )
          ),
          Effect.flatMap((res) => HttpClientResponse.schemaBodyJson(TokenResponse)(res)),
          // Retry transient errors (network issues, 5xx, 429) with exponential backoff
          Effect.retry({
            schedule: transientRetrySchedule,
            while: isTransientHttpError,
          }),
          Effect.mapError((error) => {
            if (error instanceof ImisAuthError) return error
            if (error instanceof MissingCredentialsError) return error
            if (error instanceof EnvironmentNotFoundError) return error
            if (error instanceof DatabaseError) return error
            return new ImisAuthError({
              message: "Failed to authenticate with IMIS",
              cause: error,
            })
          }),
          Effect.scoped
        )

        // Store token in session (no expiry tracking - we handle 401 instead)
        yield* session.setImisToken(envId, response.access_token, Date.now() + response.expires_in * 1000)

        return response.access_token
      }).pipe(
        Effect.withSpan("imis.fetchToken", {
          attributes: { environmentId: envId, endpoint: "/token" },
        })
      )

    // Ensure we have a valid token, fetching one if needed
    const ensureToken = (envId: string) =>
      Effect.gen(function* () {
        const existingToken = yield* session.getImisToken(envId)
        if (existingToken) {
          return existingToken
        }
        return yield* fetchToken(envId)
      })

    // Clear token and fetch a fresh one (preserves password)
    const refreshToken = (envId: string) =>
      Effect.gen(function* () {
        // Preserve password before clearing session
        const password = yield* session.getPassword(envId)
        yield* session.clearSession(envId)
        if (password) {
          yield* session.setPassword(envId, password)
        }
        return yield* fetchToken(envId)
      })

    // Execute an authenticated request with 401 retry and transient error retry
    const executeWithAuth = <A, E>(
      envId: string,
      endpoint: string,
      makeRequest: (baseUrl: string, token: string) => Effect.Effect<A, E>
    ) =>
      Effect.gen(function* () {
        const env = yield* persistence.getEnvironmentById(envId)
        const token = yield* ensureToken(envId)

        return yield* makeRequest(env.baseUrl, token).pipe(
          // Retry transient errors (network issues, 5xx, 429) with exponential backoff
          Effect.retry({
            schedule: transientRetrySchedule,
            while: isTransientHttpError,
          }),
          Effect.catchAll((error) => {
            // Check if this is a 401 response error (after retries exhausted)
            if (
              HttpClientError.isHttpClientError(error) &&
              error._tag === "ResponseError" &&
              error.response.status === 401
            ) {
              return Effect.gen(function* () {
                const newToken = yield* refreshToken(envId)
                // Also retry the new request for transient errors
                return yield* makeRequest(env.baseUrl, newToken).pipe(
                  Effect.retry({
                    schedule: transientRetrySchedule,
                    while: isTransientHttpError,
                  })
                )
              })
            }
            // Re-raise other errors
            return Effect.fail(error)
          }),
          Effect.mapError((error) => {
            // Pass through known error types
            if (error instanceof ImisAuthError) return error
            if (error instanceof ImisRequestError) return error
            if (error instanceof ImisResponseError) return error
            if (error instanceof ImisSchemaError) return error
            if (error instanceof MissingCredentialsError) return error
            if (error instanceof EnvironmentNotFoundError) return error
            if (error instanceof DatabaseError) return error

            // Handle HTTP client errors
            if (HttpClientError.isHttpClientError(error)) {
              if (error._tag === "ResponseError") {
                return new ImisResponseError({
                  message: `IMIS request failed with status ${error.response.status}`,
                  status: error.response.status,
                  cause: error,
                })
              }
              return new ImisRequestError({
                message: "Failed to connect to IMIS",
                cause: error,
              })
            }

            // Handle schema parse errors with detailed formatting
            if (isParseError(error)) {
              const formattedError = formatParseError(error)
              return new ImisSchemaError({
                message: `Response from ${endpoint} did not match expected schema`,
                endpoint,
                parseError: formattedError,
                cause: error,
              })
            }

            // Unknown error - log and wrap
            console.error("[ImisApi] Unknown error:", error)
            return new ImisRequestError({
              message: `Unknown error during IMIS request to ${endpoint}`,
              cause: error,
            })
          })
        )
      })

    // ---------------------
    // Public API
    // ---------------------

    return {
      /**
       * Authenticate with an IMIS environment and store the token.
       * Requires password to be set in session first.
       */
      authenticate: (envId: string) =>
        fetchToken(envId).pipe(
          Effect.asVoid,
          Effect.withSpan("imis.authenticate", {
            attributes: { environmentId: envId },
          })
        ),

      /**
       * Health check - verifies credentials by calling GET /api/party?limit=1
       * Will automatically authenticate if needed, and retry once on 401.
       */
      healthCheck: (envId: string) =>
        executeWithAuth(envId, "/api/party", (baseUrl, token) =>
          HttpClientRequest.get(`${baseUrl}/api/party`).pipe(
            HttpClientRequest.setUrlParam("limit", "1"),
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            httpClient.execute,
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return Effect.succeed({ success: true })
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.get(`${baseUrl}/api/party`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        ).pipe(
          Effect.withSpan("imis.healthCheck", {
            attributes: { environmentId: envId, endpoint: "/api/party" },
          })
        ),

      /**
       * Get BoEntityDefinitions (data sources) from an IMIS environment.
       * Will automatically authenticate if needed, and retry once on 401.
       */
      getBoEntityDefinitions: (envId: string, limit: number = 500) =>
        executeWithAuth(envId, "/api/BoEntityDefinition", (baseUrl, token) =>
          HttpClientRequest.get(`${baseUrl}/api/BoEntityDefinition`).pipe(
            HttpClientRequest.setUrlParam("limit", String(limit)),
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            httpClient.execute,
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return HttpClientResponse.schemaBodyJson(BoEntityDefinitionQueryResponseSchema)(res)
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.get(`${baseUrl}/api/BoEntityDefinition`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        ).pipe(
          Effect.withSpan("imis.getBoEntityDefinitions", {
            attributes: { environmentId: envId, endpoint: "/api/BoEntityDefinition", limit },
          })
        ),

      /**
       * Get a document summary by path from an IMIS environment.
       * Used to get folder info for browsing the CMS.
       */
      getDocumentByPath: (envId: string, path: string) =>
        executeWithAuth(envId, "/api/DocumentSummary/_execute", (baseUrl, token) =>
          HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            HttpClientRequest.setHeader("Content-Type", "application/json"),
            HttpClientRequest.bodyJson({
              $type: "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
              EntityTypeName: "DocumentSummary",
              OperationName: "FindByPath",
              Parameters: {
                $type: "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
                $values: [
                  {
                    $type: "System.String",
                    $value: path,
                  },
                ],
              },
            }),
            Effect.flatMap((req) => httpClient.execute(req)),
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return HttpClientResponse.schemaBodyJson(DocumentSummaryResultSchema)(res)
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        ).pipe(
          Effect.withSpan("imis.getDocumentByPath", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/DocumentSummary/_execute",
              operation: "FindByPath",
              path,
            },
          })
        ),

      /**
       * Get all documents in a folder by folder ID.
       * Used for browsing the CMS file structure.
       */
      getDocumentsInFolder: (envId: string, folderId: string, fileTypes: string[]) =>
        executeWithAuth(envId, "/api/DocumentSummary/_execute", (baseUrl, token) =>
          HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            HttpClientRequest.setHeader("Content-Type", "application/json"),
            HttpClientRequest.bodyJson({
              $type: "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
              EntityTypeName: "DocumentSummary",
              OperationName: "FindDocumentsInFolder",
              Parameters: {
                $type: "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
                $values: [
                  {
                    $type: "System.String",
                    $value: folderId,
                  },
                  {
                    $type: "System.String[]",
                    $values: fileTypes,
                  },
                  {
                    $type: "System.Boolean",
                    $value: false,
                  },
                ],
              },
            }),
            Effect.flatMap((req) => httpClient.execute(req)),
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return HttpClientResponse.schemaBodyJson(DocumentSummaryCollectionResultSchema)(res)
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        ).pipe(
          Effect.withSpan("imis.getDocumentsInFolder", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/DocumentSummary/_execute",
              operation: "FindDocumentsInFolder",
              folderId,
              fileTypesCount: fileTypes.length,
            },
          })
        ),

      /**
       * Get a query definition by path from an IMIS environment.
       * Returns the full IQA query definition including properties.
       */
      getQueryDefinition: (envId: string, path: string) =>
        executeWithAuth(envId, "/api/QueryDefinition/_execute", (baseUrl, token) =>
          HttpClientRequest.post(`${baseUrl}/api/QueryDefinition/_execute`).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            HttpClientRequest.setHeader("Content-Type", "application/json"),
            HttpClientRequest.bodyJson({
              $type: "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
              OperationName: "FindByPath",
              EntityTypeName: "QueryDefinition",
              Parameters: {
                $type: "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
                $values: [
                  {
                    $type: "System.String",
                    $value: path,
                  },
                ],
              },
              ParameterTypeName: {
                $type: "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
                $values: ["System.String"],
              },
              UseJson: false,
            }),
            Effect.flatMap((req) => httpClient.execute(req)),
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return HttpClientResponse.schemaBodyJson(QueryDefinitionResultSchema)(res)
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/QueryDefinition/_execute`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        ).pipe(
          Effect.withSpan("imis.getQueryDefinition", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/QueryDefinition/_execute",
              operation: "FindByPath",
              path,
            },
          })
        ),

      /**
       * Execute an IQA query with pagination.
       * Returns rows as Record<string, unknown> where keys are property aliases.
       * Uses /api/query for EMS environments, /api/iqa for 2017 environments.
       * @param envId - Environment ID
       * @param queryPath - Full path to the query (e.g., "$/ContactManagement/DefaultContactQuery")
       * @param limit - Maximum rows to return (max 500)
       * @param offset - Starting offset for pagination
       */
      executeQuery: (envId: string, queryPath: string, limit: number = 500, offset: number = 0) =>
        Effect.gen(function* () {
          // Get environment to determine version
          const env = yield* persistence.getEnvironmentById(envId)
          const is2017 = env.version === "2017"
          const endpoint = is2017 ? "/api/iqa" : "/api/query"

          // Make the request using executeWithAuth
          const result = yield* executeWithAuth(envId, endpoint, (baseUrl, token) =>
            HttpClientRequest.get(`${baseUrl}${endpoint}`).pipe(
              HttpClientRequest.setUrlParam("queryname", queryPath),
              HttpClientRequest.setUrlParam("limit", String(Math.min(limit, 500))),
              HttpClientRequest.setUrlParam("offset", String(offset)),
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.setHeader("Accept", "application/json"),
              httpClient.execute,
              Effect.flatMap((res) => {
                if (res.status >= 200 && res.status < 300) {
                  // Use different schema based on version
                  if (is2017) {
                    return HttpClientResponse.schemaBodyJson(Iqa2017ResponseSchema)(res)
                  }
                  return HttpClientResponse.schemaBodyJson(IqaQueryResponseSchema)(res)
                }
                return Effect.fail(
                  new HttpClientError.ResponseError({
                    request: HttpClientRequest.get(`${baseUrl}${endpoint}`),
                    response: res,
                    reason: "StatusCode",
                  })
                )
              }),
              Effect.scoped
            )
          )

          // Normalize 2017 response to match EMS format
          if (is2017) {
            return normalize2017Response(result as Iqa2017Response)
          }
          return result as IqaQueryResponse
        }).pipe(
          Effect.withSpan("imis.executeQuery", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/query",
              queryPath,
              limit,
              offset,
            },
          })
        ),

      /**
       * Insert a single entity into an IMIS data source.
       * @param envId - Environment ID
       * @param entityTypeName - The entity type (e.g., "CsContact")
       * @param parentEntityTypeName - Parent entity type (e.g., "Party", "Standalone", "Event")
       * @param parentId - Parent ID for contact/event entities (pass null for Standalone)
       * @param properties - Key-value pairs of properties to insert
       */
      insertEntity: (
        envId: string,
        entityTypeName: string,
        parentEntityTypeName: string,
        parentId: string | null,
        properties: Record<string, string | number | boolean | null>
      ) =>
        executeWithAuth(envId, `/api/${entityTypeName}`, (baseUrl, token) => {
          // Build properties array
          const propertyData = Object.entries(properties).map(([name, value]) => ({
            $type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
            Name: name,
            Value: value,
          }))

          // Build identity structure based on parent type
          const parentIdentity = parentId
            ? {
                $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
                EntityTypeName: parentEntityTypeName,
                IdentityElements: {
                  $type: "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
                  $values: [parentId],
                },
              }
            : {
                $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
                EntityTypeName: parentEntityTypeName,
              }

          const body = {
            $type: "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
            EntityTypeName: entityTypeName,
            PrimaryParentEntityTypeName: parentEntityTypeName,
            Identity: {
              $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
              EntityTypeName: entityTypeName,
            },
            PrimaryParentIdentity: parentIdentity,
            Properties: {
              $type: "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts",
              $values: propertyData,
            },
          }

          return HttpClientRequest.post(`${baseUrl}/api/${entityTypeName}`).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            HttpClientRequest.setHeader("Content-Type", "application/json"),
            HttpClientRequest.bodyJson(body),
            Effect.flatMap((req) => httpClient.execute(req)),
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return Effect.void
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/${entityTypeName}`),
                  response: res,
                  reason: "StatusCode",
                })
              )
            }),
            Effect.scoped
          )
        }).pipe(
          Effect.withSpan("imis.insertEntity", {
            attributes: {
              environmentId: envId,
              endpoint: `/api/${entityTypeName}`,
              entityTypeName,
              parentEntityTypeName,
              hasParentId: parentId !== null,
            },
          })
        ),
    }
  }),

  dependencies: [SessionService.Default, PersistenceService.Default, FetchHttpClient.layer],
}) {
  // Static Test layer for testing
  static Test = Layer.succeed(
    this,
    new ImisApiService({
      authenticate: () => Effect.void,
      healthCheck: () => Effect.succeed({ success: true }),
      getBoEntityDefinitions: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.PagedResult`1[[Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts]], Asi.Contracts",
          Items: { $type: "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts]], mscorlib", $values: [] },
          Offset: 0,
          Limit: 500,
          Count: 0,
          TotalCount: 0,
          NextPageLink: null,
          HasNext: false,
          NextOffset: 0,
        }),
      getDocumentByPath: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.GenericExecuteResult, Asi.Contracts",
          Result: null,
        }),
      getDocumentsInFolder: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.GenericExecuteResult, Asi.Contracts",
          Result: { $type: "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.DocumentSummaryData, Asi.Contracts]], mscorlib", $values: [] },
        }),
      getQueryDefinition: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.GenericExecuteResult, Asi.Contracts",
          Result: null,
        }),
      executeQuery: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.PagedResult`1[[System.Object, mscorlib]], Asi.Contracts",
          Items: { $type: "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib", $values: [] },
          Offset: 0,
          Limit: 500,
          Count: 0,
          TotalCount: 0,
          NextPageLink: null,
          HasNext: false,
          NextOffset: 0,
        }),
      insertEntity: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.GenericEntityData, Asi.Contracts",
          EntityTypeName: "TestEntity",
          PrimaryParentEntityTypeName: "Party",
          Identity: {
            $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
            EntityTypeName: "TestEntity",
          },
          PrimaryParentIdentity: {
            $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
            EntityTypeName: "Party",
          },
          Properties: { $type: "Asi.Soa.Core.DataContracts.GenericPropertyDataCollection, Asi.Contracts", $values: [] },
        }),
    })
  )
}

// ---------------------
// Convenience Alias
// ---------------------

export const ImisApiServiceLive = ImisApiService.Default

