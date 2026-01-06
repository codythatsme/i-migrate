import { Schema } from "effect"

// ---------------------
// Environment Schemas
// ---------------------

export const ImisVersionSchema = Schema.Literal("EMS", "2017")

export type ImisVersion = typeof ImisVersionSchema.Type

export const EnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  baseUrl: Schema.String,
  username: Schema.String,
  version: ImisVersionSchema,
  icon: Schema.NullOr(Schema.String),
  queryConcurrency: Schema.Number,
  insertConcurrency: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

export type Environment = typeof EnvironmentSchema.Type

export const EnvironmentWithStatusSchema = Schema.Struct({
  ...EnvironmentSchema.fields,
  hasPassword: Schema.Boolean,
})

export type EnvironmentWithStatus = typeof EnvironmentWithStatusSchema.Type

export const CreateEnvironmentSchema = Schema.Struct({
  name: Schema.String,
  baseUrl: Schema.String,
  username: Schema.String,
  version: Schema.optionalWith(ImisVersionSchema, { exact: true }),
  queryConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
  insertConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
})

export type CreateEnvironment = typeof CreateEnvironmentSchema.Type

export const UpdateEnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.optionalWith(Schema.String, { exact: true }),
  baseUrl: Schema.optionalWith(Schema.String, { exact: true }),
  username: Schema.optionalWith(Schema.String, { exact: true }),
  version: Schema.optionalWith(ImisVersionSchema, { exact: true }),
  queryConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
  insertConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
})

export type UpdateEnvironment = typeof UpdateEnvironmentSchema.Type

// ---------------------
// Password Schemas
// ---------------------

export const SetPasswordSchema = Schema.Struct({
  environmentId: Schema.String,
  password: Schema.String,
})

export type SetPassword = typeof SetPasswordSchema.Type

export const EnvironmentIdSchema = Schema.Struct({
  environmentId: Schema.String,
})

export type EnvironmentId = typeof EnvironmentIdSchema.Type

export const PasswordStatusSchema = Schema.Struct({
  hasPassword: Schema.Boolean,
})

export type PasswordStatus = typeof PasswordStatusSchema.Type

// ---------------------
// Connection Test Schemas
// ---------------------

export const TestConnectionResultSchema = Schema.Struct({
  success: Schema.Boolean,
})

export type TestConnectionResult = typeof TestConnectionResultSchema.Type

// ---------------------
// Error Schemas
// ---------------------

export class DatabaseErrorSchema extends Schema.TaggedError<DatabaseErrorSchema>()(
  "DatabaseError",
  {
    message: Schema.String,
  }
) {}

export class EnvironmentNotFoundErrorSchema extends Schema.TaggedError<EnvironmentNotFoundErrorSchema>()(
  "EnvironmentNotFoundError",
  {
    id: Schema.String,
  }
) {}

export class MissingCredentialsErrorSchema extends Schema.TaggedError<MissingCredentialsErrorSchema>()(
  "MissingCredentialsError",
  {
    environmentId: Schema.String,
  }
) {}

export class ImisAuthErrorSchema extends Schema.TaggedError<ImisAuthErrorSchema>()(
  "ImisAuthError",
  {
    message: Schema.String,
  }
) {}

export class InvalidCredentialsErrorSchema extends Schema.TaggedError<InvalidCredentialsErrorSchema>()(
  "InvalidCredentialsError",
  {
    message: Schema.String,
  }
) {}

export class NotStaffAccountErrorSchema extends Schema.TaggedError<NotStaffAccountErrorSchema>()(
  "NotStaffAccountError",
  {
    username: Schema.String,
    message: Schema.String,
  }
) {}

export class ImisRequestErrorSchema extends Schema.TaggedError<ImisRequestErrorSchema>()(
  "ImisRequestError",
  {
    message: Schema.String,
  }
) {}

export class ImisResponseErrorSchema extends Schema.TaggedError<ImisResponseErrorSchema>()(
  "ImisResponseError",
  {
    message: Schema.String,
    status: Schema.Number,
  }
) {}

export class ImisSchemaErrorSchema extends Schema.TaggedError<ImisSchemaErrorSchema>()(
  "ImisSchemaError",
  {
    message: Schema.String,
    endpoint: Schema.String,
    parseError: Schema.String,
  }
) {}

export class ValidationErrorSchema extends Schema.TaggedError<ValidationErrorSchema>()(
  "ValidationError",
  {
    message: Schema.String,
  }
) {}

// Union types for common error combinations
export const EnvironmentErrorSchema = Schema.Union(
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  ValidationErrorSchema
)

export const ConnectionErrorSchema = Schema.Union(
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  MissingCredentialsErrorSchema,
  ImisAuthErrorSchema,
  ImisRequestErrorSchema,
  ImisResponseErrorSchema,
  ImisSchemaErrorSchema
)

// ---------------------
// Data Sources Schemas
// ---------------------

export const ListDataSourcesRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  limit: Schema.optionalWith(Schema.Number, { exact: true }),
})

export type ListDataSourcesRequest = typeof ListDataSourcesRequestSchema.Type

// ---------------------
// Document Schemas
// ---------------------

export const GetDocumentByPathRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  path: Schema.String,
})

export type GetDocumentByPathRequest = typeof GetDocumentByPathRequestSchema.Type

export const GetDocumentsInFolderRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  folderId: Schema.String,
  fileTypes: Schema.Array(Schema.String),
})

export type GetDocumentsInFolderRequest = typeof GetDocumentsInFolderRequestSchema.Type

// ---------------------
// Query Definition Schemas
// ---------------------

export const GetQueryDefinitionRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  path: Schema.String,
})

export type GetQueryDefinitionRequest = typeof GetQueryDefinitionRequestSchema.Type

// ---------------------
// Trace Schemas
// ---------------------

export const SpanEventSchema = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  attributes: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), { exact: true }),
})

export type SpanEvent = typeof SpanEventSchema.Type

export const StoredSpanSchema = Schema.Struct({
  id: Schema.String,
  traceId: Schema.String,
  parentSpanId: Schema.NullOr(Schema.String),
  name: Schema.String,
  status: Schema.Literal("ok", "error", "running"),
  kind: Schema.String,
  startTime: Schema.Number,
  endTime: Schema.NullOr(Schema.Number),
  durationMs: Schema.NullOr(Schema.Number),
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  events: Schema.Array(SpanEventSchema),
  errorCause: Schema.NullOr(Schema.String),
})

export type StoredSpan = typeof StoredSpanSchema.Type

export const StoredTraceSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: Schema.Literal("ok", "error", "running"),
  startTime: Schema.Number,
  endTime: Schema.NullOr(Schema.Number),
  durationMs: Schema.NullOr(Schema.Number),
  errorMessage: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  spans: Schema.Array(StoredSpanSchema),
})

export type StoredTrace = typeof StoredTraceSchema.Type

export const TraceSummarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: Schema.Literal("ok", "error", "running"),
  startTime: Schema.Number,
  durationMs: Schema.NullOr(Schema.Number),
  createdAt: Schema.String,
  spanCount: Schema.Number,
  errorMessage: Schema.NullOr(Schema.String),
})

export type TraceSummary = typeof TraceSummarySchema.Type

export const ListTracesRequestSchema = Schema.Struct({
  limit: Schema.optionalWith(Schema.Number, { exact: true }),
  offset: Schema.optionalWith(Schema.Number, { exact: true }),
})

export type ListTracesRequest = typeof ListTracesRequestSchema.Type

export const GetTraceRequestSchema = Schema.Struct({
  traceId: Schema.String,
})

export type GetTraceRequest = typeof GetTraceRequestSchema.Type

export class TraceNotFoundErrorSchema extends Schema.TaggedError<TraceNotFoundErrorSchema>()(
  "TraceNotFoundError",
  {
    traceId: Schema.String,
  }
) {}

export class TraceStoreErrorSchema extends Schema.TaggedError<TraceStoreErrorSchema>()(
  "TraceStoreError",
  {
    message: Schema.String,
  }
) {}

// ---------------------
// Job Schemas
// ---------------------

export const JobStatusSchema = Schema.Literal(
  "queued",
  "running",
  "completed",
  "failed",
  "partial",
  "cancelled"
)

export type JobStatus = typeof JobStatusSchema.Type

export const JobModeSchema = Schema.Literal("query", "datasource")

export type JobMode = typeof JobModeSchema.Type

export const PropertyMappingSchema = Schema.Struct({
  sourceProperty: Schema.String,
  destinationProperty: Schema.NullOr(Schema.String),
})

export type PropertyMapping = typeof PropertyMappingSchema.Type

export const JobSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: JobStatusSchema,
  mode: JobModeSchema,
  sourceEnvironmentId: Schema.String,
  sourceQueryPath: Schema.NullOr(Schema.String),
  sourceEntityType: Schema.NullOr(Schema.String),
  destEnvironmentId: Schema.String,
  destEntityType: Schema.String,
  mappings: Schema.String, // JSON stringified PropertyMapping[]
  totalRows: Schema.NullOr(Schema.Number),
  processedRows: Schema.Number,
  successfulRows: Schema.Number,
  failedRowCount: Schema.Number,
  failedQueryOffsets: Schema.NullOr(Schema.String), // JSON stringified number[]
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
})

export type Job = typeof JobSchema.Type

// Job with resolved environment names for display
export const JobWithEnvironmentsSchema = Schema.Struct({
  ...JobSchema.fields,
  sourceEnvironmentName: Schema.String,
  destEnvironmentName: Schema.String,
})

export type JobWithEnvironments = typeof JobWithEnvironmentsSchema.Type

export const FailedRowStatusSchema = Schema.Literal("pending", "retrying", "resolved")

export type FailedRowStatus = typeof FailedRowStatusSchema.Type

export const FailedRowSchema = Schema.Struct({
  id: Schema.String,
  jobId: Schema.String,
  rowIndex: Schema.Number,
  encryptedPayload: Schema.String,
  errorMessage: Schema.String,
  retryCount: Schema.Number,
  status: FailedRowStatusSchema,
  createdAt: Schema.String,
  resolvedAt: Schema.NullOr(Schema.String),
})

export type FailedRow = typeof FailedRowSchema.Type

export const CreateJobRequestSchema = Schema.Struct({
  name: Schema.String,
  mode: JobModeSchema,
  sourceEnvironmentId: Schema.String,
  sourceQueryPath: Schema.optionalWith(Schema.String, { exact: true }),
  sourceEntityType: Schema.optionalWith(Schema.String, { exact: true }),
  destEnvironmentId: Schema.String,
  destEntityType: Schema.String,
  mappings: Schema.Array(PropertyMappingSchema),
})

export type CreateJobRequest = typeof CreateJobRequestSchema.Type

export const CreateJobResponseSchema = Schema.Struct({
  jobId: Schema.String,
})

export type CreateJobResponse = typeof CreateJobResponseSchema.Type

export const JobIdRequestSchema = Schema.Struct({
  jobId: Schema.String,
})

export type JobIdRequest = typeof JobIdRequestSchema.Type

export const RunJobResponseSchema = Schema.Struct({
  started: Schema.Boolean,
})

export type RunJobResponse = typeof RunJobResponseSchema.Type

export const RetryFailedRowsResponseSchema = Schema.Struct({
  retriedCount: Schema.Number,
  successCount: Schema.Number,
  failCount: Schema.Number,
})

export type RetryFailedRowsResponse = typeof RetryFailedRowsResponseSchema.Type

// Job Error Schemas
export class JobNotFoundErrorSchema extends Schema.TaggedError<JobNotFoundErrorSchema>()(
  "JobNotFoundError",
  {
    jobId: Schema.String,
  }
) {}

export class JobAlreadyRunningErrorSchema extends Schema.TaggedError<JobAlreadyRunningErrorSchema>()(
  "JobAlreadyRunning",
  {
    jobId: Schema.String,
  }
) {}

export class MigrationErrorSchema extends Schema.TaggedError<MigrationErrorSchema>()(
  "MigrationError",
  {
    message: Schema.String,
  }
) {}

