import { RpcClient, RpcSerialization } from "@effect/rpc";
import { FetchHttpClient } from "@effect/platform";
import { Layer, Effect, ManagedRuntime } from "effect";
import { ApiGroup } from "./procedures";

// ---------------------
// Client Layer
// ---------------------

// Protocol layer needs HttpClient and RpcSerialization
// Using FetchHttpClient instead of BrowserHttpClient.layerXMLHttpRequest
// to avoid "Refused to set unsafe header content-length" warnings
const ProtocolLayer = RpcClient.layerProtocolHttp({ url: "/rpc" }).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerJson),
);

// Complete client layer
const ClientLayer = Layer.mergeAll(ProtocolLayer, RpcSerialization.layerJson);

// ---------------------
// Helper for scoped RPC calls
// ---------------------

// Each call creates a fresh runtime to avoid shared state corruption.
// A shared ManagedRuntime can enter a bad state where promises never resolve
// even though HTTP responses complete successfully.
const withClient = <A, E>(
  fn: (client: RpcClient.FromGroup<typeof ApiGroup>) => Effect.Effect<A, E>,
): Promise<A> => {
  const runtime = ManagedRuntime.make(ClientLayer);

  return runtime
    .runPromise(Effect.scoped(Effect.flatMap(RpcClient.make(ApiGroup), fn)))
    .finally(() => runtime.dispose());
};

// ---------------------
// Type-Safe API Functions
// ---------------------

// These functions can be called directly from React components
// and TanStack Query hooks

/** List all environments with password status */
export const listEnvironments = () => withClient((client) => client.environments.list());

/** Get a single environment by ID */
export const getEnvironment = (environmentId: string) =>
  withClient((client) => client.environments.get({ environmentId }));

/** Create a new environment */
export const createEnvironment = (data: {
  name: string;
  baseUrl: string;
  username: string;
  version?: "EMS" | "2017";
  queryConcurrency?: number;
  insertConcurrency?: number;
}) => withClient((client) => client.environments.create(data));

/** Update an existing environment */
export const updateEnvironment = (data: {
  id: string;
  name?: string;
  baseUrl?: string;
  username?: string;
  version?: "EMS" | "2017";
  queryConcurrency?: number;
  insertConcurrency?: number;
}) => withClient((client) => client.environments.update(data));

/** Delete an environment */
export const deleteEnvironment = (environmentId: string) =>
  withClient((client) => client.environments.delete({ environmentId }));

/** Set password for an environment */
export const setPassword = (environmentId: string, password: string) =>
  withClient((client) => client.password.set({ environmentId, password }));

/** Clear password for an environment */
export const clearPassword = (environmentId: string) =>
  withClient((client) => client.password.clear({ environmentId }));

/** Get password status for an environment */
export const getPasswordStatus = (environmentId: string) =>
  withClient((client) => client.password.status({ environmentId }));

/** Test connection to an IMIS environment */
export const testConnection = (environmentId: string) =>
  withClient((client) => client.connection.test({ environmentId }));

/** List data sources (BoEntityDefinitions) from an IMIS environment */
export const listDataSources = (environmentId: string, limit?: number) =>
  withClient((client) =>
    client.datasources.list(limit !== undefined ? { environmentId, limit } : { environmentId }),
  );

/** Get a document summary by path */
export const getDocumentByPath = (environmentId: string, path: string) =>
  withClient((client) => client.documents.byPath({ environmentId, path }));

/** Get all documents in a folder by folder ID */
export const getDocumentsInFolder = (
  environmentId: string,
  folderId: string,
  fileTypes: string[],
) => withClient((client) => client.documents.inFolder({ environmentId, folderId, fileTypes }));

/** Get a query definition by path */
export const getQueryDefinition = (environmentId: string, path: string) =>
  withClient((client) => client.queries.definition({ environmentId, path }));

// ---------------------
// Trace Functions
// ---------------------

/** List recent traces */
export const listTraces = (limit?: number, offset?: number) =>
  withClient((client) =>
    client.traces.list({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
    }),
  );

/** Get a single trace with all spans */
export const getTrace = (traceId: string) => withClient((client) => client.traces.get({ traceId }));

/** Clear all traces */
export const clearTraces = () => withClient((client) => client.traces.clear());

/** Export all traces (returns full trace data for download) */
export const exportTraces = () => withClient((client) => client.traces.export());

// ---------------------
// Job Functions
// ---------------------

/** Create a new migration job */
export const createJob = (data: {
  name: string;
  mode: "query" | "datasource";
  sourceEnvironmentId: string;
  sourceQueryPath?: string;
  sourceEntityType?: string;
  destEnvironmentId: string;
  destEntityType: string;
  destType?: "bo_entity" | "custom_endpoint";
  mappings: Array<{ sourceProperty: string; destinationProperty: string | null }>;
}) => withClient((client) => client.jobs.create(data));

/** List all jobs */
export const listJobs = () => withClient((client) => client.jobs.list());

/** Get a single job by ID */
export const getJob = (jobId: string) => withClient((client) => client.jobs.get({ jobId }));

/** Run a queued job */
export const runJob = (jobId: string) => withClient((client) => client.jobs.run({ jobId }));

/** Retry failed rows for a job */
export const retryFailedRows = (jobId: string) =>
  withClient((client) => client.jobs.retry({ jobId }));

/** Retry a single failed row */
export const retrySingleRow = (rowId: string) =>
  withClient((client) => client.jobs.retrySingleRow({ rowId }));

/** Get rows for a job (with attempt info) */
export const getJobRows = (jobId: string, options?: { status?: "success" | "failed" }) =>
  withClient((client) =>
    client.jobs.rows({
      jobId,
      ...(options?.status !== undefined && { status: options.status }),
    }),
  );

/** Get attempts for a specific row */
export const getRowAttempts = (rowId: string) =>
  withClient((client) => client.rows.attempts({ rowId }));

/** Cancel a running job */
export const cancelJob = (jobId: string) => withClient((client) => client.jobs.cancel({ jobId }));

/** Delete a job and its associated failed rows */
export const deleteJob = (jobId: string) => withClient((client) => client.jobs.delete({ jobId }));

// ---------------------
// Settings Functions
// ---------------------

/** Get current settings */
export const getSettings = () => withClient((client) => client.settings.get());

/** Enable password storage with master password */
export const enablePasswordStorage = (masterPassword: string) =>
  withClient((client) => client.settings.enableStorage({ masterPassword }));

/** Disable password storage (clears all stored passwords) */
export const disablePasswordStorage = () => withClient((client) => client.settings.disableStorage());

/** Verify master password and unlock stored passwords */
export const verifyMasterPassword = (masterPassword: string) =>
  withClient((client) => client.settings.verifyMasterPassword({ masterPassword }));

/** Change master password (re-encrypts all stored passwords) */
export const changeMasterPassword = (currentPassword: string, newPassword: string) =>
  withClient((client) => client.settings.changeMasterPassword({ currentPassword, newPassword }));

/** Lock stored passwords (clear master password from memory) */
export const lockPasswords = () => withClient((client) => client.settings.lock());

// ---------------------
// Re-export types for convenience
// ---------------------

export type {
  ImisVersion,
  Environment,
  EnvironmentWithStatus,
  CreateEnvironment,
  UpdateEnvironment,
  PasswordStatus,
  TestConnectionResult,
  TraceSummary,
  StoredTrace,
  StoredSpan,
  Job,
  JobWithCounts,
  JobWithEnvironments,
  JobStatus,
  JobMode,
  Row,
  RowStatus,
  RowWithAttemptsInfo,
  Attempt,
  AttemptReason,
  GetJobRowsResponse,
  PropertyMapping,
  CreateJobRequest,
  CreateJobResponse,
  RunJobResponse,
  RetryFailedRowsResponse,
  RetrySingleRowResponse,
  Settings,
} from "./schemas";

export type {
  BoEntityDefinition,
  BoProperty,
  QueryResponse,
  DocumentSummaryData,
  DocumentSummaryResult,
  DocumentSummaryCollectionResult,
  QueryDefinition,
  QueryDefinitionResult,
  QueryPropertyData,
} from "./imis-schemas";
