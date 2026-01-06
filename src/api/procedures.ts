import { Rpc, RpcGroup } from "@effect/rpc"
import { Schema } from "effect"
import {
  EnvironmentSchema,
  EnvironmentWithStatusSchema,
  CreateEnvironmentSchema,
  UpdateEnvironmentSchema,
  SetPasswordSchema,
  EnvironmentIdSchema,
  PasswordStatusSchema,
  TestConnectionResultSchema,
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
  ListDataSourcesRequestSchema,
  GetDocumentByPathRequestSchema,
  GetDocumentsInFolderRequestSchema,
  GetQueryDefinitionRequestSchema,
  TraceSummarySchema,
  StoredTraceSchema,
  ListTracesRequestSchema,
  GetTraceRequestSchema,
  TraceNotFoundErrorSchema,
  TraceStoreErrorSchema,
  // Job schemas
  JobSchema,
  JobWithEnvironmentsSchema,
  FailedRowSchema,
  CreateJobRequestSchema,
  CreateJobResponseSchema,
  JobIdRequestSchema,
  RunJobResponseSchema,
  RetryFailedRowsResponseSchema,
  JobNotFoundErrorSchema,
  JobAlreadyRunningErrorSchema,
  MigrationErrorSchema,
} from "./schemas"
import {
  BoEntityDefinitionQueryResponseSchema,
  DocumentSummaryResultSchema,
  DocumentSummaryCollectionResultSchema,
  QueryDefinitionResultSchema,
} from "./imis-schemas"

// ---------------------
// Environment Procedures
// ---------------------

/** List all environments with password status */
const ListEnvironments = Rpc.make("environments.list", {
  success: Schema.Array(EnvironmentWithStatusSchema),
  error: DatabaseErrorSchema,
})

/** Get a single environment by ID */
const GetEnvironment = Rpc.make("environments.get", {
  payload: EnvironmentIdSchema,
  success: EnvironmentWithStatusSchema,
  error: Schema.Union(DatabaseErrorSchema, EnvironmentNotFoundErrorSchema),
})

/** Create a new environment */
const CreateEnvironment = Rpc.make("environments.create", {
  payload: CreateEnvironmentSchema,
  success: EnvironmentSchema,
  error: Schema.Union(DatabaseErrorSchema, ValidationErrorSchema),
})

/** Update an existing environment */
const UpdateEnvironment = Rpc.make("environments.update", {
  payload: UpdateEnvironmentSchema,
  success: EnvironmentSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    ValidationErrorSchema
  ),
})

/** Delete an environment */
const DeleteEnvironment = Rpc.make("environments.delete", {
  payload: EnvironmentIdSchema,
  error: Schema.Union(DatabaseErrorSchema, EnvironmentNotFoundErrorSchema),
})

// ---------------------
// Password Procedures
// ---------------------

/** Set password for an environment (stored in server memory) */
const SetPassword = Rpc.make("password.set", {
  payload: SetPasswordSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    InvalidCredentialsErrorSchema,
    NotStaffAccountErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema
  ),
})

/** Clear password for an environment */
const ClearPassword = Rpc.make("password.clear", {
  payload: EnvironmentIdSchema,
})

/** Check if password is set for an environment */
const GetPasswordStatus = Rpc.make("password.status", {
  payload: EnvironmentIdSchema,
  success: PasswordStatusSchema,
})

// ---------------------
// Connection Test Procedures
// ---------------------

/** Test connection to an IMIS environment */
const TestConnection = Rpc.make("connection.test", {
  payload: EnvironmentIdSchema,
  success: TestConnectionResultSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

// ---------------------
// Data Sources Procedures
// ---------------------

/** List BoEntityDefinitions (data sources) from an IMIS environment */
const ListDataSources = Rpc.make("datasources.list", {
  payload: ListDataSourcesRequestSchema,
  success: BoEntityDefinitionQueryResponseSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

// ---------------------
// Document Procedures
// ---------------------

/** Get a document summary by path */
const GetDocumentByPath = Rpc.make("documents.byPath", {
  payload: GetDocumentByPathRequestSchema,
  success: DocumentSummaryResultSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

/** Get all documents in a folder */
const GetDocumentsInFolder = Rpc.make("documents.inFolder", {
  payload: GetDocumentsInFolderRequestSchema,
  success: DocumentSummaryCollectionResultSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

// ---------------------
// Query Definition Procedures
// ---------------------

/** Get a query definition by path */
const GetQueryDefinition = Rpc.make("queries.definition", {
  payload: GetQueryDefinitionRequestSchema,
  success: QueryDefinitionResultSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    EnvironmentNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

// ---------------------
// Trace Procedures
// ---------------------

/** List recent traces with summaries */
const ListTraces = Rpc.make("traces.list", {
  payload: ListTracesRequestSchema,
  success: Schema.Array(TraceSummarySchema),
  error: TraceStoreErrorSchema,
})

/** Get a single trace with all spans */
const GetTrace = Rpc.make("traces.get", {
  payload: GetTraceRequestSchema,
  success: Schema.NullOr(StoredTraceSchema),
  error: TraceStoreErrorSchema,
})

/** Clear all traces */
const ClearTraces = Rpc.make("traces.clear", {
  error: TraceStoreErrorSchema,
})

// ---------------------
// Job Procedures
// ---------------------

/** Create a new migration job */
const CreateJob = Rpc.make("jobs.create", {
  payload: CreateJobRequestSchema,
  success: CreateJobResponseSchema,
  error: Schema.Union(DatabaseErrorSchema, ValidationErrorSchema),
})

/** List all jobs */
const ListJobs = Rpc.make("jobs.list", {
  success: Schema.Array(JobWithEnvironmentsSchema),
  error: DatabaseErrorSchema,
})

/** Get a single job by ID */
const GetJob = Rpc.make("jobs.get", {
  payload: JobIdRequestSchema,
  success: JobWithEnvironmentsSchema,
  error: Schema.Union(DatabaseErrorSchema, JobNotFoundErrorSchema),
})

/** Run a queued job */
const RunJob = Rpc.make("jobs.run", {
  payload: JobIdRequestSchema,
  success: RunJobResponseSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    JobNotFoundErrorSchema,
    JobAlreadyRunningErrorSchema,
    MigrationErrorSchema,
    MissingCredentialsErrorSchema,
    EnvironmentNotFoundErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

/** Retry failed rows for a job */
const RetryFailedRows = Rpc.make("jobs.retry", {
  payload: JobIdRequestSchema,
  success: RetryFailedRowsResponseSchema,
  error: Schema.Union(
    DatabaseErrorSchema,
    JobNotFoundErrorSchema,
    MissingCredentialsErrorSchema,
    EnvironmentNotFoundErrorSchema,
    ImisAuthErrorSchema,
    ImisRequestErrorSchema,
    ImisResponseErrorSchema,
    ImisSchemaErrorSchema
  ),
})

/** Get failed rows for a job */
const GetJobFailedRows = Rpc.make("jobs.failedRows", {
  payload: JobIdRequestSchema,
  success: Schema.Array(FailedRowSchema),
  error: DatabaseErrorSchema,
})

/** Cancel a running job */
const CancelJob = Rpc.make("jobs.cancel", {
  payload: JobIdRequestSchema,
  error: Schema.Union(DatabaseErrorSchema, JobNotFoundErrorSchema),
})

/** Delete a job and its associated failed rows */
const DeleteJob = Rpc.make("jobs.delete", {
  payload: JobIdRequestSchema,
  error: Schema.Union(DatabaseErrorSchema, JobNotFoundErrorSchema),
})

// ---------------------
// API Group
// ---------------------

/** Complete API definition */
export const ApiGroup = RpcGroup.make(
  // Environments
  ListEnvironments,
  GetEnvironment,
  CreateEnvironment,
  UpdateEnvironment,
  DeleteEnvironment,
  // Password
  SetPassword,
  ClearPassword,
  GetPasswordStatus,
  // Connection
  TestConnection,
  // Data Sources
  ListDataSources,
  // Documents
  GetDocumentByPath,
  GetDocumentsInFolder,
  // Query Definitions
  GetQueryDefinition,
  // Traces
  ListTraces,
  GetTrace,
  ClearTraces,
  // Jobs
  CreateJob,
  ListJobs,
  GetJob,
  RunJob,
  RetryFailedRows,
  GetJobFailedRows,
  CancelJob,
  DeleteJob
)

// Export type for the API group
export type ApiGroup = typeof ApiGroup

