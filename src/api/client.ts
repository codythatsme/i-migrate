import { RpcClient, RpcSerialization } from "@effect/rpc"
import { FetchHttpClient } from "@effect/platform"
import { Layer, Effect, ManagedRuntime } from "effect"
import { ApiGroup } from "./procedures"

// ---------------------
// Client Layer
// ---------------------

// Protocol layer needs HttpClient and RpcSerialization
// Using FetchHttpClient instead of BrowserHttpClient.layerXMLHttpRequest
// to avoid "Refused to set unsafe header content-length" warnings
const ProtocolLayer = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerJson)
)

// Complete client layer
const ClientLayer = Layer.mergeAll(
  ProtocolLayer,
  RpcSerialization.layerJson
)

// ---------------------
// Managed Runtime
// ---------------------

// Create a managed runtime for the client
const runtime = ManagedRuntime.make(ClientLayer)

// ---------------------
// Helper for scoped RPC calls
// ---------------------

// Each call creates a fresh client within a scope
const withClient = <A, E>(
  fn: (client: RpcClient.FromGroup<typeof ApiGroup>) => Effect.Effect<A, E>
): Promise<A> =>
  runtime.runPromise(
    Effect.scoped(
      Effect.flatMap(RpcClient.make(ApiGroup), fn)
    )
  )

// ---------------------
// Type-Safe API Functions
// ---------------------

// These functions can be called directly from React components
// and TanStack Query hooks

/** List all environments with password status */
export const listEnvironments = () =>
  withClient((client) => client.environments.list())

/** Get a single environment by ID */
export const getEnvironment = (environmentId: string) =>
  withClient((client) => client.environments.get({ environmentId }))

/** Create a new environment */
export const createEnvironment = (data: {
  name: string
  baseUrl: string
  username: string
}) => withClient((client) => client.environments.create(data))

/** Update an existing environment */
export const updateEnvironment = (data: {
  id: string
  name?: string
  baseUrl?: string
  username?: string
}) => withClient((client) => client.environments.update(data))

/** Delete an environment */
export const deleteEnvironment = (environmentId: string) =>
  withClient((client) => client.environments.delete({ environmentId }))

/** Set password for an environment */
export const setPassword = (environmentId: string, password: string) =>
  withClient((client) => client.password.set({ environmentId, password }))

/** Clear password for an environment */
export const clearPassword = (environmentId: string) =>
  withClient((client) => client.password.clear({ environmentId }))

/** Get password status for an environment */
export const getPasswordStatus = (environmentId: string) =>
  withClient((client) => client.password.status({ environmentId }))

/** Test connection to an IMIS environment */
export const testConnection = (environmentId: string) =>
  withClient((client) => client.connection.test({ environmentId }))

/** List data sources (BoEntityDefinitions) from an IMIS environment */
export const listDataSources = (environmentId: string, limit?: number) =>
  withClient((client) =>
    client.datasources.list(
      limit !== undefined ? { environmentId, limit } : { environmentId }
    )
  )

// ---------------------
// Re-export types for convenience
// ---------------------

export type {
  Environment,
  EnvironmentWithStatus,
  CreateEnvironment,
  UpdateEnvironment,
  PasswordStatus,
  TestConnectionResult,
} from "./schemas"

export type {
  BoEntityDefinition,
  BoProperty,
  QueryResponse,
} from "./imis-schemas"
