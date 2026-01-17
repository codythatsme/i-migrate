import { Effect, Layer, Data, Schema, ParseResult, Schedule, Duration } from "effect";
import type { BinaryBlob } from "./migration-job";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as HttpClientError from "@effect/platform/HttpClientError";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { SessionService } from "./session";
import { PersistenceService, EnvironmentNotFoundError, DatabaseError } from "./persistence";
import {
  BoEntityDefinitionQueryResponseSchema,
  DocumentSummaryResultSchema,
  DocumentSummaryCollectionResultSchema,
  QueryDefinitionResultSchema,
  QueryDefinition2017Schema,
  IqaQueryResponseSchema,
  Iqa2017ResponseSchema,
  DataSourceResponseSchema,
  GetUserRolesResponseSchema,
  type QueryDefinition,
  type QueryDefinitionResult,
  type IqaQueryResponse,
  type Iqa2017Response,
  type DataSourceResponse,
  type UserRoleData,
} from "../api/imis-schemas";

// ---------------------
// Domain Errors
// ---------------------

export class ImisAuthError extends Data.TaggedError("ImisAuthError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ImisRequestError extends Data.TaggedError("ImisRequestError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ImisResponseError extends Data.TaggedError("ImisResponseError")<{
  readonly message: string;
  readonly status: number;
  readonly body?: string;
  readonly cause?: unknown;
}> {}

export class ImisSchemaError extends Data.TaggedError("ImisSchemaError")<{
  readonly message: string;
  readonly endpoint: string;
  readonly parseError: string;
  readonly cause?: unknown;
}> {}

// Result type for entity insertion
export type InsertEntityResult = {
  identityElements: string[];
};

export class MissingCredentialsError extends Data.TaggedError("MissingCredentialsError")<{
  readonly environmentId: string;
}> {
  override get message() {
    return `Password not set for environment: ${this.environmentId}`;
  }
}

// Type alias for all API errors returned by executeWithAuth
export type ImisApiError =
  | ImisAuthError
  | ImisRequestError
  | ImisResponseError
  | ImisSchemaError
  | MissingCredentialsError
  | EnvironmentNotFoundError
  | DatabaseError;

export class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotStaffAccountError extends Data.TaggedError("NotStaffAccountError")<{
  readonly username: string;
  readonly message: string;
}> {}

// ---------------------
// Internal Auth Errors (not exported - mapped to InvalidCredentialsError at boundary)
// ---------------------

class AuthHttpError extends Data.TaggedError("AuthHttpError")<{
  readonly status: number;
  readonly body: string;
}> {
  override get message() {
    return `Authentication failed: HTTP ${this.status}`;
  }
}

class AuthParseError extends Data.TaggedError("AuthParseError")<{
  readonly parseError: ParseResult.ParseError;
  readonly rawBody: string;
}> {
  override get message() {
    return `Failed to parse token response: ${this.parseError.message}`;
  }
}

// ---------------------
// Retry Configuration
// ---------------------

// Retry schedule: exponential backoff starting at 500ms, factor of 2, up to 3 retries
// This gives delays of: 500ms, 1000ms, 2000ms
const transientRetrySchedule = Schedule.exponential(Duration.millis(500), 2).pipe(
  Schedule.intersect(Schedule.recurs(3)),
);

// Determines if an HTTP error is transient (worth retrying)
const isTransientHttpError = (error: unknown): boolean => {
  if (HttpClientError.isHttpClientError(error)) {
    // Network/connection errors are transient
    if (error._tag === "RequestError") {
      return true;
    }
    // 5xx server errors and 429 (rate limit) are transient
    if (error._tag === "ResponseError") {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }
  }
  return false;
};

// ---------------------
// Error Detection Helpers
// ---------------------

const isParseError = (error: unknown): error is ParseResult.ParseError =>
  error instanceof Error && error.name === "ParseError";

const formatParseError = (error: ParseResult.ParseError): string => {
  try {
    return ParseResult.TreeFormatter.formatErrorSync(error);
  } catch {
    return error.message;
  }
};

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
    const wrapped = value as { $type: string; $value: unknown };
    // Preserve blob structure for binary data
    if (wrapped.$type === "System.Byte[], mscorlib") {
      return value;
    }
    return wrapped.$value;
  }
  return value;
};

/**
 * Normalize a 2017 IQA response to match the EMS format.
 * Converts GenericEntityData rows with Properties array to flat Record<string, unknown>.
 * Skips properties with undefined Value (some 2017 properties may be missing values).
 */
const normalize2017Response = (response: Iqa2017Response): IqaQueryResponse => ({
  ...response,
  Items: {
    ...response.Items,
    $values: response.Items.$values.map((row) =>
      Object.fromEntries(
        row.Properties.$values
          .filter((p) => p.Value !== undefined)
          .map((p) => [p.Name, unwrapValue(p.Value)]),
      ),
    ),
  },
});

/**
 * Normalize a data source response to match the IQA query format.
 * Converts GenericEntityData rows with Properties array to flat Record<string, unknown>.
 * Very similar to normalize2017Response but handles optional Value fields.
 */
const normalizeDataSourceResponse = (response: DataSourceResponse): IqaQueryResponse => ({
  $type: response.$type,
  Items: {
    $type: response.Items.$type,
    $values: response.Items.$values.map((row) =>
      Object.fromEntries(
        row.Properties.$values
          .filter((p) => p.Value !== undefined) // Skip properties with no value
          .map((p) => [p.Name, unwrapValue(p.Value)]),
      ),
    ),
  },
  Offset: response.Offset,
  Limit: response.Limit,
  Count: response.Count,
  TotalCount: response.TotalCount,
  NextPageLink: response.NextPageLink,
  HasNext: response.HasNext,
  NextOffset: response.NextOffset,
});

// ---------------------
// Schemas
// ---------------------

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  token_type: Schema.String,
  expires_in: Schema.Number,
});

type TokenResponse = typeof TokenResponse.Type;

// ---------------------
// Service Definition
// ---------------------

export class ImisApiService extends Effect.Service<ImisApiService>()("app/ImisApiService", {
  accessors: true,

  effect: Effect.gen(function* () {
    const session = yield* SessionService;
    const persistence = yield* PersistenceService;
    const httpClient = yield* HttpClient.HttpClient;

    // ---------------------
    // Internal Helpers
    // ---------------------

    // Verbose logging helper - logs requests/responses when enabled
    const logVerbose = (type: "REQ" | "RES", method: string, url: string, body?: unknown) =>
      Effect.gen(function* () {
        const settings = yield* persistence.getSettings();
        if (settings?.verboseLogging) {
          const ts = new Date().toISOString();
          console.log(`[IMIS ${ts}] ${type} ${method} ${url}`);
          if (body !== undefined) {
            // Redact password in token requests
            const sanitized =
              typeof body === "string" && body.includes("password=")
                ? body.replace(/password=[^&]+/, "password=****")
                : body;
            console.log(
              `[IMIS ${ts}] BODY:`,
              typeof sanitized === "string" ? sanitized : JSON.stringify(sanitized),
            );
          }
        }
      }).pipe(Effect.ignore);

    // Fetch a new token from IMIS /token endpoint
    const fetchToken = (envId: string) =>
      Effect.gen(function* () {
        // Get environment config
        const env = yield* persistence.getEnvironmentById(envId);

        // Get password from session
        const password = yield* session.getPassword(envId);
        if (!password) {
          return yield* Effect.fail(new MissingCredentialsError({ environmentId: envId }));
        }

        // Build token request
        const tokenUrl = `${env.baseUrl}/token`;
        const body = new URLSearchParams({
          grant_type: "password",
          username: env.username,
          password: password,
        });

        // Log request
        yield* logVerbose("REQ", "POST", tokenUrl, body.toString());

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
                  }),
                ),
          ),
          Effect.flatMap((res) => HttpClientResponse.schemaBodyJson(TokenResponse)(res)),
          // Retry transient errors (network issues, 5xx, 429) with exponential backoff
          Effect.retry({
            schedule: transientRetrySchedule,
            while: isTransientHttpError,
          }),
          Effect.mapError((error) => {
            if (error instanceof ImisAuthError) return error;
            if (error instanceof MissingCredentialsError) return error;
            if (error instanceof EnvironmentNotFoundError) return error;
            if (error instanceof DatabaseError) return error;
            return new ImisAuthError({
              message: "Failed to authenticate with IMIS",
              cause: error,
            });
          }),
          Effect.scoped,
        );

        // Log response
        yield* logVerbose("RES", "POST", tokenUrl, {
          access_token: response.access_token.substring(0, 20) + "...",
          token_type: response.token_type,
          expires_in: response.expires_in,
        });

        // Store token in session (no expiry tracking - we handle 401 instead)
        yield* session.setImisToken(
          envId,
          response.access_token,
          Date.now() + response.expires_in * 1000,
        );

        return response.access_token;
      }).pipe(
        Effect.withSpan("imis.fetchToken", {
          attributes: { environmentId: envId, endpoint: "/token" },
        }),
      );

    // Ensure we have a valid token, fetching one if needed
    const ensureToken = (envId: string) =>
      Effect.gen(function* () {
        const existingToken = yield* session.getImisToken(envId);
        if (existingToken) {
          return existingToken;
        }
        return yield* fetchToken(envId);
      });

    // Clear token and fetch a fresh one (preserves password)
    const refreshToken = (envId: string) =>
      Effect.gen(function* () {
        // Preserve password before clearing session
        const password = yield* session.getPassword(envId);
        yield* session.clearSession(envId);
        if (password) {
          yield* session.setPassword(envId, password);
        }
        return yield* fetchToken(envId);
      });

    // Execute an authenticated request with 401 retry and transient error retry
    const executeWithAuth = <A, E>(
      envId: string,
      endpoint: string,
      makeRequest: (baseUrl: string, token: string) => Effect.Effect<A, E>,
      options?: { method?: string; body?: unknown },
    ) =>
      Effect.gen(function* () {
        const env = yield* persistence.getEnvironmentById(envId);
        const token = yield* ensureToken(envId);
        const fullUrl = `${env.baseUrl}${endpoint}`;
        const method = options?.method ?? "GET";

        // Log request
        yield* logVerbose("REQ", method, fullUrl, options?.body);

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
                const newToken = yield* refreshToken(envId);
                // Also retry the new request for transient errors
                return yield* makeRequest(env.baseUrl, newToken).pipe(
                  Effect.retry({
                    schedule: transientRetrySchedule,
                    while: isTransientHttpError,
                  }),
                );
              });
            }
            // Re-raise other errors
            return Effect.fail(error);
          }),
          Effect.catchAll((error): Effect.Effect<never, ImisApiError> => {
            // Pass through known error types
            if (error instanceof ImisAuthError) return Effect.fail(error);
            if (error instanceof ImisRequestError) return Effect.fail(error);
            if (error instanceof ImisResponseError) return Effect.fail(error);
            if (error instanceof ImisSchemaError) return Effect.fail(error);
            if (error instanceof MissingCredentialsError) return Effect.fail(error);
            if (error instanceof EnvironmentNotFoundError) return Effect.fail(error);
            if (error instanceof DatabaseError) return Effect.fail(error);

            // Handle HTTP client errors
            if (HttpClientError.isHttpClientError(error)) {
              if (error._tag === "ResponseError") {
                // Read response body for error details
                return error.response.text.pipe(
                  Effect.scoped,
                  Effect.catchAll(() => Effect.succeed("")),
                  Effect.tap((body) =>
                    Effect.annotateCurrentSpan({
                      "error.response.body": body || "",
                      "error.response.status": error.response.status,
                    }),
                  ),
                  Effect.flatMap((body) =>
                    Effect.fail(
                      new ImisResponseError({
                        message: `IMIS request failed with status ${error.response.status}`,
                        status: error.response.status,
                        body: body || undefined,
                        cause: error,
                      }),
                    ),
                  ),
                );
              }
              return Effect.fail(
                new ImisRequestError({
                  message: "Failed to connect to IMIS",
                  cause: error,
                }),
              );
            }

            // Handle schema parse errors with detailed formatting
            if (isParseError(error)) {
              const formattedError = formatParseError(error);
              return Effect.fail(
                new ImisSchemaError({
                  message: `Response from ${endpoint} did not match expected schema`,
                  endpoint,
                  parseError: formattedError,
                  cause: error,
                }),
              );
            }

            // Unknown error - log and wrap
            console.error("[ImisApi] Unknown error:", error);
            return Effect.fail(
              new ImisRequestError({
                message: `Unknown error during IMIS request to ${endpoint}`,
                cause: error,
              }),
            );
          }),
          // Log response (success or error)
          Effect.tap(() => logVerbose("RES", method, `${fullUrl} (success)`)),
          Effect.tapError((error) =>
            logVerbose("RES", method, `${fullUrl} (error: ${error._tag})`),
          ),
        );
      });

    // Authenticate with a password directly (without storing it first)
    // Used for credential validation before storing the password
    const authenticateWithPassword = (baseUrl: string, username: string, password: string) =>
      Effect.gen(function* () {
        const body = new URLSearchParams({
          grant_type: "password",
          username: username,
          password: password,
        });

        const request = HttpClientRequest.post(`${baseUrl}/token`).pipe(
          HttpClientRequest.setHeader("Content-Type", "application/x-www-form-urlencoded"),
          HttpClientRequest.setHeader("Accept", "application/json"),
          HttpClientRequest.bodyText(body.toString(), "application/x-www-form-urlencoded"),
        );

        const response = yield* httpClient.execute(request).pipe(
          Effect.retry({
            schedule: transientRetrySchedule,
            while: isTransientHttpError,
          }),
          Effect.scoped,
        );

        // Read body once for both error reporting and parsing
        const rawBody = yield* response.text;

        // HTTP error - preserve status and body for debugging
        if (response.status < 200 || response.status >= 300) {
          return yield* Effect.fail(
            new AuthHttpError({
              status: response.status,
              body: rawBody,
            }),
          );
        }

        // Parse JSON and validate schema
        const json = yield* Effect.try({
          try: () => JSON.parse(rawBody) as unknown,
          catch: (error) =>
            new AuthParseError({
              parseError: new ParseResult.ParseError({
                issue: new ParseResult.Type(Schema.Unknown.ast, rawBody, `Invalid JSON: ${error}`),
              }),
              rawBody,
            }),
        });

        const tokenData = yield* Schema.decodeUnknown(TokenResponse)(json).pipe(
          Effect.mapError(
            (parseError) =>
              new AuthParseError({
                parseError,
                rawBody,
              }),
          ),
        );

        return tokenData.access_token;
      }).pipe(
        Effect.withSpan("imis.authenticateWithPassword", {
          attributes: { endpoint: "/token" },
        }),
        // Annotate span with error details for debugging
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({
            "error.type": error._tag,
            "error.message": error.message,
            ...(error instanceof AuthHttpError && {
              "http.response.status": error.status,
              "http.response.body": error.body,
            }),
            ...(error instanceof AuthParseError && {
              "parse.rawBody": error.rawBody,
            }),
          }),
        ),
        // Map internal errors to InvalidCredentialsError at boundary
        Effect.mapError((error) => {
          if (error instanceof AuthHttpError) {
            return new InvalidCredentialsError({
              message: error.message,
              cause: error,
            });
          }
          if (error instanceof AuthParseError) {
            return new InvalidCredentialsError({
              message: error.message,
              cause: error,
            });
          }
          // Network/transport errors
          return new InvalidCredentialsError({
            message: "Authentication failed due to network error",
            cause: error,
          });
        }),
      );

    // Get user roles using a provided token
    // Used for credential validation to check staff role
    const getUserRolesWithToken = (baseUrl: string, username: string, token: string) =>
      Effect.gen(function* () {
        const request = yield* HttpClientRequest.post(`${baseUrl}/api/UserSecurity/_execute`).pipe(
          HttpClientRequest.bearerToken(token),
          HttpClientRequest.setHeader("Accept", "application/json"),
          HttpClientRequest.setHeader("Content-Type", "application/json"),
          HttpClientRequest.bodyJson({
            $type: "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
            OperationName: "GetUserRoles",
            EntityTypeName: "UserSecurity",
            Parameters: {
              $type:
                "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
              $values: [{ $type: "System.String", $value: username }],
            },
            ParameterTypeName: {
              $type:
                "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
            },
            UseJson: false,
          }),
        );

        const response = yield* httpClient.execute(request).pipe(
          Effect.retry({
            schedule: transientRetrySchedule,
            while: isTransientHttpError,
          }),
          Effect.scoped,
        );

        if (response.status < 200 || response.status >= 300) {
          return yield* Effect.fail(
            new ImisRequestError({ message: `Failed to get user roles: HTTP ${response.status}` }),
          );
        }

        const result = yield* HttpClientResponse.schemaBodyJson(GetUserRolesResponseSchema)(
          response,
        ).pipe(
          Effect.mapError(
            (error) =>
              new ImisRequestError({
                message: "Failed to parse user roles response",
                cause: error,
              }),
          ),
        );

        if (!result.IsSuccessStatusCode || !result.Result) {
          return yield* Effect.fail(
            new ImisRequestError({ message: result.Message || "Failed to get user roles" }),
          );
        }

        return result.Result;
      }).pipe(
        Effect.mapError((error) => {
          if (error instanceof ImisRequestError) return error;
          return new ImisRequestError({
            message: "Failed to get user roles",
            cause: error,
          });
        }),
      );

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
          }),
        ),

      /**
       * Validate credentials for an environment.
       * This method authenticates WITHOUT storing the password first,
       * used to validate passwords before storing them.
       *
       * @returns Effect that succeeds if credentials are valid and user has Staff role
       * @throws InvalidCredentialsError if authentication fails
       * @throws NotStaffAccountError if user is not a staff account
       */
      validateCredentials: (envId: string, password: string) =>
        Effect.gen(function* () {
          // Get environment config
          const env = yield* persistence.getEnvironmentById(envId);

          // Step 1: Try to authenticate and get token
          const token = yield* authenticateWithPassword(env.baseUrl, env.username, password);

          // 2017 environments don't support role checking via UserSecurity endpoint
          if (env.version === "2017") {
            return { success: true };
          }

          // Step 2: Get user roles using the obtained token
          const roles = yield* getUserRolesWithToken(env.baseUrl, env.username, token);

          // Step 3: Check for SysAdmin role (case-insensitive)
          const hasSysAdminRole = roles.$values.some(
            (role: UserRoleData) => role.RoleName.toLowerCase() === "sysadmin",
          );

          if (!hasSysAdminRole) {
            return yield* Effect.fail(
              new NotStaffAccountError({
                username: env.username,
                message: `Account "${env.username}" does not have the SysAdmin role required for migrations`,
              }),
            );
          }

          return { success: true };
        }).pipe(
          Effect.withSpan("imis.validateCredentials", {
            attributes: { environmentId: envId },
          }),
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
                return Effect.succeed({ success: true });
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.get(`${baseUrl}/api/party`),
                  response: res,
                  reason: "StatusCode",
                }),
              );
            }),
            Effect.scoped,
          ),
        ).pipe(
          Effect.withSpan("imis.healthCheck", {
            attributes: { environmentId: envId, endpoint: "/api/party" },
          }),
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
                return HttpClientResponse.schemaBodyJson(BoEntityDefinitionQueryResponseSchema)(
                  res,
                );
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.get(`${baseUrl}/api/BoEntityDefinition`),
                  response: res,
                  reason: "StatusCode",
                }),
              );
            }),
            Effect.scoped,
          ),
        ).pipe(
          Effect.withSpan("imis.getBoEntityDefinitions", {
            attributes: { environmentId: envId, endpoint: "/api/BoEntityDefinition", limit },
          }),
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
                $type:
                  "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
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
                return HttpClientResponse.schemaBodyJson(DocumentSummaryResultSchema)(res);
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`),
                  response: res,
                  reason: "StatusCode",
                }),
              );
            }),
            Effect.scoped,
          ),
        ).pipe(
          Effect.withSpan("imis.getDocumentByPath", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/DocumentSummary/_execute",
              operation: "FindByPath",
              path,
            },
          }),
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
                $type:
                  "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
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
                return HttpClientResponse.schemaBodyJson(DocumentSummaryCollectionResultSchema)(
                  res,
                );
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.post(`${baseUrl}/api/DocumentSummary/_execute`),
                  response: res,
                  reason: "StatusCode",
                }),
              );
            }),
            Effect.scoped,
          ),
        ).pipe(
          Effect.withSpan("imis.getDocumentsInFolder", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/DocumentSummary/_execute",
              operation: "FindDocumentsInFolder",
              folderId,
              fileTypesCount: fileTypes.length,
            },
          }),
        ),

      /**
       * Get a query definition by path from an IMIS environment.
       * Returns the full IQA query definition including properties.
       * Uses different parsing for 2017 (top-level) vs EMS (wrapped in Result).
       */
      getQueryDefinition: (envId: string, path: string) =>
        Effect.gen(function* () {
          // Get environment to determine version
          const env = yield* persistence.getEnvironmentById(envId);
          const is2017 = env.version === "2017";

          // Make the request - always parse as EMS format first
          const rawResult = yield* executeWithAuth(
            envId,
            "/api/QueryDefinition/_execute",
            (baseUrl, token) =>
              HttpClientRequest.post(`${baseUrl}/api/QueryDefinition/_execute`).pipe(
                HttpClientRequest.bearerToken(token),
                HttpClientRequest.setHeader("Accept", "application/json"),
                HttpClientRequest.setHeader("Content-Type", "application/json"),
                HttpClientRequest.bodyJson({
                  $type: "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
                  OperationName: "FindByPath",
                  EntityTypeName: "QueryDefinition",
                  Parameters: {
                    $type:
                      "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
                    $values: [
                      {
                        $type: "System.String",
                        $value: path,
                      },
                    ],
                  },
                  ParameterTypeName: {
                    $type:
                      "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
                    $values: ["System.String"],
                  },
                  UseJson: false,
                }),
                Effect.flatMap((req) => httpClient.execute(req)),
                Effect.flatMap((res) => {
                  if (res.status >= 200 && res.status < 300) {
                    // Get raw JSON - we'll parse based on version afterwards
                    return HttpClientResponse.schemaBodyJson(Schema.Unknown)(res);
                  }
                  return Effect.fail(
                    new HttpClientError.ResponseError({
                      request: HttpClientRequest.post(`${baseUrl}/api/QueryDefinition/_execute`),
                      response: res,
                      reason: "StatusCode",
                    }),
                  );
                }),
                Effect.scoped,
              ),
          );

          // Parse and normalize based on version
          if (is2017) {
            // 2017 returns QueryDefinition directly at top level (without Document field)
            const queryDef2017 = yield* Schema.decodeUnknown(QueryDefinition2017Schema)(rawResult);

            // Create a synthetic Document for 2017 to match EMS format
            // Extract name from path (e.g., "$/Queries/MyQuery" -> "MyQuery")
            const queryName = queryDef2017.Path.split("/").pop() ?? queryDef2017.Path;
            const syntheticDocument = {
              $type: "Asi.Soa.Core.DataContracts.DocumentData, Asi.Contracts" as const,
              Name: queryName,
              DocumentId: queryDef2017.QueryDefinitionId,
              DocumentVersionId: queryDef2017.QueryDefinitionId,
              DocumentTypeId: "IQD",
              Path: queryDef2017.Path,
              FolderPath: queryDef2017.Path.substring(0, queryDef2017.Path.lastIndexOf("/")),
              Status: "Published" as const,
              AccessId: "",
              StatusUpdatedByUserId: "",
              StatusUpdatedOn: new Date().toISOString(),
              UpdateInfo: {
                $type:
                  "Asi.Soa.Core.DataContracts.EntityUpdateInformationData, Asi.Contracts" as const,
              },
            };

            // Normalize Properties: fill in missing fields with defaults
            const normalizedProperties = {
              ...queryDef2017.Properties,
              $values: queryDef2017.Properties.$values.map((prop, index) => ({
                ...prop,
                PropertyName: prop.PropertyName ?? prop.Name,
                Alias: prop.Alias ?? prop.Name,
                Caption: prop.Caption ?? prop.Name,
                DisplayFormat: prop.DisplayFormat ?? ("" as const),
                DisplayOrder: prop.DisplayOrder ?? index,
                Link: prop.Link ?? "",
              })),
            };

            // Normalize Relations: fill in missing RelationType with default
            const normalizedRelations = {
              ...queryDef2017.Relations,
              $values: queryDef2017.Relations.$values.map((rel) => ({
                ...rel,
                RelationType: rel.RelationType ?? ("Equal" as const),
              })),
            };

            // Normalize Sources: fill in missing BusinessControllerName with default
            const normalizedSources = {
              ...queryDef2017.Sources,
              $values: queryDef2017.Sources.$values.map((src) => ({
                ...src,
                BusinessControllerName: src.BusinessControllerName ?? "",
              })),
            };

            // Merge with synthetic Document and normalized Properties/Relations/Sources
            const normalizedQueryDef: QueryDefinition = {
              ...queryDef2017,
              Document: syntheticDocument,
              Properties: normalizedProperties,
              Relations: normalizedRelations,
              Sources: normalizedSources,
            };

            return {
              $type: "Asi.Soa.Core.DataContracts.GenericExecuteResult, Asi.Contracts" as const,
              Result: normalizedQueryDef,
            } as QueryDefinitionResult;
          }
          // EMS wraps in { Result: ... }
          return yield* Schema.decodeUnknown(QueryDefinitionResultSchema)(rawResult);
        }).pipe(
          Effect.mapError((error) => {
            if (isParseError(error)) {
              return new ImisSchemaError({
                message: `Response from /api/QueryDefinition/_execute did not match expected schema`,
                endpoint: "/api/QueryDefinition/_execute",
                parseError: formatParseError(error),
                cause: error,
              });
            }
            return error;
          }),
          Effect.withSpan("imis.getQueryDefinition", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/QueryDefinition/_execute",
              operation: "FindByPath",
              path,
            },
          }),
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
          const env = yield* persistence.getEnvironmentById(envId);
          const is2017 = env.version === "2017";
          const endpoint = is2017 ? "/api/iqa" : "/api/query";

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
                    return HttpClientResponse.schemaBodyJson(Iqa2017ResponseSchema)(res);
                  }
                  return HttpClientResponse.schemaBodyJson(IqaQueryResponseSchema)(res);
                }
                return Effect.fail(
                  new HttpClientError.ResponseError({
                    request: HttpClientRequest.get(`${baseUrl}${endpoint}`),
                    response: res,
                    reason: "StatusCode",
                  }),
                );
              }),
              Effect.scoped,
            ),
          );

          // Normalize 2017 response to match EMS format
          if (is2017) {
            return normalize2017Response(result as Iqa2017Response);
          }
          return result as IqaQueryResponse;
        }).pipe(
          Effect.withSpan("imis.executeQuery", {
            attributes: {
              environmentId: envId,
              endpoint: "/api/query",
              queryPath,
              limit,
              offset,
            },
          }),
        ),

      /**
       * Fetch data from a data source entity type with pagination.
       * Normalizes nested Properties to flat Record<string, unknown>.
       * @param envId - Environment ID
       * @param entityTypeName - The data source entity type name (e.g., "CsContact")
       * @param limit - Maximum rows to return (max 500)
       * @param offset - Starting offset for pagination
       */
      fetchDataSource: (
        envId: string,
        entityTypeName: string,
        limit: number = 500,
        offset: number = 0,
      ) =>
        Effect.gen(function* () {
          // Make the request using executeWithAuth (same pattern as executeQuery)
          const result = yield* executeWithAuth(envId, `/api/${entityTypeName}`, (baseUrl, token) =>
            HttpClientRequest.get(`${baseUrl}/api/${entityTypeName}`).pipe(
              HttpClientRequest.setUrlParam("limit", String(Math.min(limit, 500))),
              HttpClientRequest.setUrlParam("offset", String(offset)),
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.setHeader("Accept", "application/json"),
              httpClient.execute,
              Effect.flatMap((res) => {
                if (res.status >= 200 && res.status < 300) {
                  return HttpClientResponse.schemaBodyJson(DataSourceResponseSchema)(res);
                }
                // Same error pattern as executeQuery
                return Effect.fail(
                  new HttpClientError.ResponseError({
                    request: HttpClientRequest.get(`${baseUrl}/api/${entityTypeName}`),
                    response: res,
                    reason: "StatusCode",
                  }),
                );
              }),
              Effect.scoped,
            ),
          );

          // Normalize to flat format (matches query response)
          return normalizeDataSourceResponse(result);
        }).pipe(
          Effect.withSpan("imis.fetchDataSource", {
            attributes: {
              environmentId: envId,
              endpoint: `/api/${entityTypeName}`,
              entityTypeName,
              limit,
              offset,
            },
          }),
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
        properties: Record<string, string | number | boolean | null | BinaryBlob>,
      ) => {
        // Build properties array
        const propertyData = Object.entries(properties).map(([name, value]) => ({
          $type: "Asi.Soa.Core.DataContracts.GenericPropertyData, Asi.Contracts",
          Name: name,
          Value: value,
        }));

        // Build identity structure based on parent type
        const parentIdentity = parentId
          ? {
              $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
              EntityTypeName: parentEntityTypeName,
              IdentityElements: {
                $type:
                  "System.Collections.ObjectModel.Collection`1[[System.String, mscorlib]], mscorlib",
                $values: [parentId],
              },
            }
          : {
              $type: "Asi.Soa.Core.DataContracts.IdentityData, Asi.Contracts",
              EntityTypeName: parentEntityTypeName,
            };

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
        };

        return executeWithAuth(
          envId,
          `/api/${entityTypeName}`,
          (baseUrl, token) =>
            HttpClientRequest.post(`${baseUrl}/api/${entityTypeName}`).pipe(
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.setHeader("Accept", "application/json"),
              HttpClientRequest.setHeader("Content-Type", "application/json"),
              HttpClientRequest.bodyJson(body),
              Effect.flatMap((req) => httpClient.execute(req)),
              Effect.flatMap((res) => {
                if (res.status >= 200 && res.status < 300) {
                  // Parse response body as JSON to extract identity elements
                  return HttpClientResponse.schemaBodyJson(Schema.Unknown)(res).pipe(
                    Effect.map((data): InsertEntityResult => {
                      // Try to extract identity elements from the response
                      // The structure is: { Identity: { IdentityElements: { $values: [...] } } }
                      const identityElements: string[] = [];
                      if (data && typeof data === "object" && "Identity" in data) {
                        const identity = (data as Record<string, unknown>).Identity;
                        if (
                          identity &&
                          typeof identity === "object" &&
                          "IdentityElements" in identity
                        ) {
                          const identityElems = (identity as Record<string, unknown>)
                            .IdentityElements;
                          if (
                            identityElems &&
                            typeof identityElems === "object" &&
                            "$values" in identityElems &&
                            Array.isArray((identityElems as Record<string, unknown>).$values)
                          ) {
                            identityElements.push(
                              ...(
                                (identityElems as Record<string, unknown>).$values as unknown[]
                              ).map(String),
                            );
                          }
                        }
                      }
                      return { identityElements };
                    }),
                    // Fallback for edge cases where response body is empty or malformed
                    Effect.catchAll(() =>
                      Effect.succeed({ identityElements: [] } as InsertEntityResult),
                    ),
                  );
                }
                return Effect.fail(
                  new HttpClientError.ResponseError({
                    request: HttpClientRequest.post(`${baseUrl}/api/${entityTypeName}`),
                    response: res,
                    reason: "StatusCode",
                  }),
                );
              }),
              Effect.scoped,
            ),
          { method: "POST", body },
        ).pipe(
          Effect.withSpan("imis.insertEntity", {
            attributes: {
              environmentId: envId,
              endpoint: `/api/${entityTypeName}`,
              entityTypeName,
              parentEntityTypeName,
              hasParentId: parentId !== null,
            },
          }),
        );
      },

      /**
       * Get the names of identity fields for an entity type.
       * @param envId - Environment ID
       * @param entityTypeName - The entity type name
       * @returns Array of identity field names (e.g., ["ID", "Ordinal"])
       */
      getIdentityFieldNames: (envId: string, entityTypeName: string) =>
        executeWithAuth(envId, "/api/BoEntityDefinition", (baseUrl, token) =>
          HttpClientRequest.get(`${baseUrl}/api/BoEntityDefinition`).pipe(
            HttpClientRequest.setUrlParam("limit", "500"),
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.setHeader("Accept", "application/json"),
            httpClient.execute,
            Effect.flatMap((res) => {
              if (res.status >= 200 && res.status < 300) {
                return HttpClientResponse.schemaBodyJson(BoEntityDefinitionQueryResponseSchema)(
                  res,
                );
              }
              return Effect.fail(
                new HttpClientError.ResponseError({
                  request: HttpClientRequest.get(`${baseUrl}/api/BoEntityDefinition`),
                  response: res,
                  reason: "StatusCode",
                }),
              );
            }),
            Effect.map((definitions) => {
              const entityDef = definitions.Items.$values.find(
                (d) => d.EntityTypeName === entityTypeName,
              );
              if (!entityDef || !entityDef.Properties) return [] as string[];
              return entityDef.Properties.$values
                .filter((p) => p.IsIdentity === true)
                .map((p) => p.Name);
            }),
            Effect.scoped,
          ),
        ).pipe(
          Effect.withSpan("imis.getIdentityFieldNames", {
            attributes: {
              environmentId: envId,
              entityTypeName,
            },
          }),
        ),

      /**
       * Insert data via a custom API endpoint (non-GenericEntityData format).
       * Used for endpoints like PartyImage that have their own data contract.
       * @param envId - Environment ID
       * @param endpointPath - API endpoint path (e.g., "api/PartyImage")
       * @param body - Pre-built request body with $type field
       * @param identityExtractor - Function to extract identity elements from response
       * @returns Identity elements extracted from response
       */
      insertCustomEndpoint: (
        envId: string,
        endpointPath: string,
        body: unknown,
        identityExtractor: (response: unknown) => string[],
      ) =>
        executeWithAuth(
          envId,
          `/${endpointPath}`,
          (baseUrl, token) =>
            HttpClientRequest.post(`${baseUrl}/${endpointPath}`).pipe(
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.setHeader("Accept", "application/json"),
              HttpClientRequest.setHeader("Content-Type", "application/json"),
              HttpClientRequest.bodyJson(body),
              Effect.flatMap((req) => httpClient.execute(req)),
              Effect.flatMap((res) => {
                if (res.status >= 200 && res.status < 300) {
                  return HttpClientResponse.schemaBodyJson(Schema.Unknown)(res).pipe(
                    Effect.map(
                      (data): InsertEntityResult => ({
                        identityElements: identityExtractor(data),
                      }),
                    ),
                    Effect.catchAll(() =>
                      Effect.succeed({ identityElements: [] } as InsertEntityResult),
                    ),
                  );
                }
                return Effect.fail(
                  new HttpClientError.ResponseError({
                    request: HttpClientRequest.post(`${baseUrl}/${endpointPath}`),
                    response: res,
                    reason: "StatusCode",
                  }),
                );
              }),
              Effect.scoped,
            ),
          { method: "POST", body },
        ).pipe(
          Effect.withSpan("imis.insertCustomEndpoint", {
            attributes: {
              environmentId: envId,
              endpoint: `/${endpointPath}`,
            },
          }),
        ),
    };
  }),

  dependencies: [SessionService.Default, PersistenceService.Default, FetchHttpClient.layer],
}) {
  // Static Test layer for testing
  static Test = Layer.succeed(
    this,
    new ImisApiService({
      authenticate: () => Effect.void,
      validateCredentials: () => Effect.succeed({ success: true }),
      healthCheck: () => Effect.succeed({ success: true }),
      getBoEntityDefinitions: () =>
        Effect.succeed({
          $type:
            "Asi.Soa.Core.DataContracts.PagedResult`1[[Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts]], Asi.Contracts",
          Items: {
            $type:
              "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.BOEntityDefinitionData, Asi.Contracts]], mscorlib",
            $values: [],
          },
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
          Result: {
            $type:
              "System.Collections.Generic.List`1[[Asi.Soa.Core.DataContracts.DocumentSummaryData, Asi.Contracts]], mscorlib",
            $values: [],
          },
        }),
      getQueryDefinition: () =>
        Effect.succeed({
          $type: "Asi.Soa.Core.DataContracts.GenericExecuteResult, Asi.Contracts",
          Result: null,
        }),
      executeQuery: () =>
        Effect.succeed({
          $type:
            "Asi.Soa.Core.DataContracts.PagedResult`1[[System.Object, mscorlib]], Asi.Contracts",
          Items: {
            $type:
              "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
            $values: [],
          },
          Offset: 0,
          Limit: 500,
          Count: 0,
          TotalCount: 0,
          NextPageLink: null,
          HasNext: false,
          NextOffset: 0,
        }),
      fetchDataSource: () =>
        Effect.succeed({
          $type:
            "Asi.Soa.Core.DataContracts.PagedResult`1[[System.Object, mscorlib]], Asi.Contracts",
          Items: {
            $type:
              "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
            $values: [],
          },
          Offset: 0,
          Limit: 500,
          Count: 0,
          TotalCount: 0,
          NextPageLink: null,
          HasNext: false,
          NextOffset: 0,
        }),
      insertEntity: () => Effect.succeed({ identityElements: ["12345"] }),
      getIdentityFieldNames: () => Effect.succeed(["ID"]),
      insertCustomEndpoint: (_envId, _path, _body, extractor) =>
        Effect.succeed({ identityElements: extractor({}) }),
    }),
  );
}

// ---------------------
// Convenience Alias
// ---------------------

export const ImisApiServiceLive = ImisApiService.Default;
