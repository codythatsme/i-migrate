import { Effect, Layer, Data, Schema } from "effect"
import * as HttpClient from "@effect/platform/HttpClient"
import * as HttpClientRequest from "@effect/platform/HttpClientRequest"
import * as HttpClientResponse from "@effect/platform/HttpClientResponse"
import * as HttpClientError from "@effect/platform/HttpClientError"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { SessionService } from "./session"
import { PersistenceService, EnvironmentNotFoundError, DatabaseError } from "./persistence"
import {
  BoEntityDefinitionQueryResponseSchema,
  type QueryResponse,
  type BoEntityDefinition,
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

export class MissingCredentialsError extends Data.TaggedError("MissingCredentialsError")<{
  readonly environmentId: string
}> {
  override get message() {
    return `Password not set for environment: ${this.environmentId}`
  }
}

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
    const fetchToken = (
      envId: string
    ): Effect.Effect<
      string,
      ImisAuthError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
    > =>
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

        // Make token request
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
      })

    // Ensure we have a valid token, fetching one if needed
    const ensureToken = (
      envId: string
    ): Effect.Effect<
      string,
      ImisAuthError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
    > =>
      Effect.gen(function* () {
        const existingToken = yield* session.getImisToken(envId)
        if (existingToken) {
          return existingToken
        }
        return yield* fetchToken(envId)
      })

    // Clear token and fetch a fresh one
    const refreshToken = (
      envId: string
    ): Effect.Effect<
      string,
      ImisAuthError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
    > =>
      Effect.gen(function* () {
        yield* session.clearSession(envId).pipe(
          Effect.flatMap(() => session.getPassword(envId)),
          Effect.flatMap((password) =>
            password
              ? session.setPassword(envId, password)
              : Effect.void
          )
        )
        // Re-fetch password since we cleared the session
        const password = yield* session.getPassword(envId)
        if (!password) {
          // Password was cleared with session, need to get it again
          // Actually, we need to preserve the password before clearing
        }
        return yield* fetchToken(envId)
      })

    // Execute an authenticated request with 401 retry
    const executeWithAuth = <A>(
      envId: string,
      makeRequest: (baseUrl: string, token: string) => Effect.Effect<A, HttpClientError.HttpClientError>
    ): Effect.Effect<
      A,
      ImisAuthError | ImisRequestError | ImisResponseError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
    > =>
      Effect.gen(function* () {
        const env = yield* persistence.getEnvironmentById(envId)
        const token = yield* ensureToken(envId)

        return yield* makeRequest(env.baseUrl, token).pipe(
          Effect.catchIf(
            (error): error is HttpClientError.ResponseError =>
              HttpClientError.isHttpClientError(error) &&
              error._tag === "ResponseError" &&
              error.response.status === 401,
            () =>
              Effect.gen(function* () {
                // Clear old token and get fresh one
                // Preserve password before clearing session
                const password = yield* session.getPassword(envId)
                yield* session.clearSession(envId)
                if (password) {
                  yield* session.setPassword(envId, password)
                }
                const newToken = yield* fetchToken(envId)
                return yield* makeRequest(env.baseUrl, newToken)
              })
          ),
          Effect.mapError((error) => {
            if (error instanceof ImisAuthError) return error
            if (error instanceof ImisRequestError) return error
            if (error instanceof ImisResponseError) return error
            if (error instanceof MissingCredentialsError) return error
            if (error instanceof EnvironmentNotFoundError) return error
            if (error instanceof DatabaseError) return error

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

            return new ImisRequestError({
              message: "Unknown error during IMIS request",
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
      authenticate: (
        envId: string
      ): Effect.Effect<
        void,
        ImisAuthError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
      > =>
        fetchToken(envId).pipe(Effect.asVoid),

      /**
       * Health check - verifies credentials by calling GET /api/party?limit=1
       * Will automatically authenticate if needed, and retry once on 401.
       */
      healthCheck: (
        envId: string
      ): Effect.Effect<
        { success: boolean },
        ImisAuthError | ImisRequestError | ImisResponseError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
      > =>
        executeWithAuth(envId, (baseUrl, token) =>
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
        ),

      /**
       * Get BoEntityDefinitions (data sources) from an IMIS environment.
       * Will automatically authenticate if needed, and retry once on 401.
       */
      getBoEntityDefinitions: (
        envId: string,
        limit: number = 500
      ): Effect.Effect<
        QueryResponse<BoEntityDefinition>,
        ImisAuthError | ImisRequestError | ImisResponseError | MissingCredentialsError | EnvironmentNotFoundError | DatabaseError
      > =>
        executeWithAuth(envId, (baseUrl, token) =>
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
    })
  )
}

// ---------------------
// Convenience Alias
// ---------------------

export const ImisApiServiceLive = ImisApiService.Default

