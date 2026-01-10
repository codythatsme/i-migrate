import { Schema } from "effect";

// ---------------------
// Environment Schemas
// ---------------------

export const ImisVersionSchema = Schema.Literal("EMS", "2017");

export type ImisVersion = typeof ImisVersionSchema.Type;

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
});

export type Environment = typeof EnvironmentSchema.Type;

export const EnvironmentWithStatusSchema = Schema.Struct({
  ...EnvironmentSchema.fields,
  hasPassword: Schema.Boolean,
});

export type EnvironmentWithStatus = typeof EnvironmentWithStatusSchema.Type;

export const CreateEnvironmentSchema = Schema.Struct({
  name: Schema.String,
  baseUrl: Schema.String,
  username: Schema.String,
  version: Schema.optionalWith(ImisVersionSchema, { exact: true }),
  queryConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
  insertConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
});

export type CreateEnvironment = typeof CreateEnvironmentSchema.Type;

export const UpdateEnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.optionalWith(Schema.String, { exact: true }),
  baseUrl: Schema.optionalWith(Schema.String, { exact: true }),
  username: Schema.optionalWith(Schema.String, { exact: true }),
  version: Schema.optionalWith(ImisVersionSchema, { exact: true }),
  queryConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
  insertConcurrency: Schema.optionalWith(Schema.Number, { exact: true }),
});

export type UpdateEnvironment = typeof UpdateEnvironmentSchema.Type;

// ---------------------
// Password Schemas
// ---------------------

export const SetPasswordSchema = Schema.Struct({
  environmentId: Schema.String,
  password: Schema.String,
});

export type SetPassword = typeof SetPasswordSchema.Type;

export const EnvironmentIdSchema = Schema.Struct({
  environmentId: Schema.String,
});

export type EnvironmentId = typeof EnvironmentIdSchema.Type;

export const PasswordStatusSchema = Schema.Struct({
  hasPassword: Schema.Boolean,
});

export type PasswordStatus = typeof PasswordStatusSchema.Type;

// ---------------------
// Connection Test Schemas
// ---------------------

export const TestConnectionResultSchema = Schema.Struct({
  success: Schema.Boolean,
});

export type TestConnectionResult = typeof TestConnectionResultSchema.Type;

// ---------------------
// Error Schemas
// ---------------------

export class DatabaseErrorSchema extends Schema.TaggedError<DatabaseErrorSchema>()(
  "DatabaseError",
  {
    message: Schema.String,
  },
) {}

export class EnvironmentNotFoundErrorSchema extends Schema.TaggedError<EnvironmentNotFoundErrorSchema>()(
  "EnvironmentNotFoundError",
  {
    id: Schema.String,
  },
) {}

export class MissingCredentialsErrorSchema extends Schema.TaggedError<MissingCredentialsErrorSchema>()(
  "MissingCredentialsError",
  {
    environmentId: Schema.String,
    message: Schema.String,
  },
) {}

export class ImisAuthErrorSchema extends Schema.TaggedError<ImisAuthErrorSchema>()(
  "ImisAuthError",
  {
    message: Schema.String,
  },
) {}

export class InvalidCredentialsErrorSchema extends Schema.TaggedError<InvalidCredentialsErrorSchema>()(
  "InvalidCredentialsError",
  {
    message: Schema.String,
  },
) {}

export class NotStaffAccountErrorSchema extends Schema.TaggedError<NotStaffAccountErrorSchema>()(
  "NotStaffAccountError",
  {
    username: Schema.String,
    message: Schema.String,
  },
) {}

export class ImisRequestErrorSchema extends Schema.TaggedError<ImisRequestErrorSchema>()(
  "ImisRequestError",
  {
    message: Schema.String,
  },
) {}

export class ImisResponseErrorSchema extends Schema.TaggedError<ImisResponseErrorSchema>()(
  "ImisResponseError",
  {
    message: Schema.String,
    status: Schema.Number,
  },
) {}

export class ImisSchemaErrorSchema extends Schema.TaggedError<ImisSchemaErrorSchema>()(
  "ImisSchemaError",
  {
    message: Schema.String,
    endpoint: Schema.String,
    parseError: Schema.String,
  },
) {}

export class ValidationErrorSchema extends Schema.TaggedError<ValidationErrorSchema>()(
  "ValidationError",
  {
    message: Schema.String,
  },
) {}

// Union types for common error combinations
export const EnvironmentErrorSchema = Schema.Union(
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  ValidationErrorSchema,
);

export const ConnectionErrorSchema = Schema.Union(
  DatabaseErrorSchema,
  EnvironmentNotFoundErrorSchema,
  MissingCredentialsErrorSchema,
  ImisAuthErrorSchema,
  ImisRequestErrorSchema,
  ImisResponseErrorSchema,
  ImisSchemaErrorSchema,
);

// ---------------------
// Data Sources Schemas
// ---------------------

export const ListDataSourcesRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  limit: Schema.optionalWith(Schema.Number, { exact: true }),
});

export type ListDataSourcesRequest = typeof ListDataSourcesRequestSchema.Type;

// ---------------------
// Document Schemas
// ---------------------

export const GetDocumentByPathRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  path: Schema.String,
});

export type GetDocumentByPathRequest = typeof GetDocumentByPathRequestSchema.Type;

export const GetDocumentsInFolderRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  folderId: Schema.String,
  fileTypes: Schema.Array(Schema.String),
});

export type GetDocumentsInFolderRequest = typeof GetDocumentsInFolderRequestSchema.Type;

// ---------------------
// Query Definition Schemas
// ---------------------

export const GetQueryDefinitionRequestSchema = Schema.Struct({
  environmentId: Schema.String,
  path: Schema.String,
});

export type GetQueryDefinitionRequest = typeof GetQueryDefinitionRequestSchema.Type;

// ---------------------
// Trace Schemas
// ---------------------

export const SpanEventSchema = Schema.Struct({
  name: Schema.String,
  timestamp: Schema.Number,
  attributes: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    exact: true,
  }),
});

export type SpanEvent = typeof SpanEventSchema.Type;

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
});

export type StoredSpan = typeof StoredSpanSchema.Type;

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
});

export type StoredTrace = typeof StoredTraceSchema.Type;

export const TraceSummarySchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: Schema.Literal("ok", "error", "running"),
  startTime: Schema.Number,
  durationMs: Schema.NullOr(Schema.Number),
  createdAt: Schema.String,
  spanCount: Schema.Number,
  errorMessage: Schema.NullOr(Schema.String),
});

export type TraceSummary = typeof TraceSummarySchema.Type;

export const ListTracesRequestSchema = Schema.Struct({
  limit: Schema.optionalWith(Schema.Number, { exact: true }),
  offset: Schema.optionalWith(Schema.Number, { exact: true }),
});

export type ListTracesRequest = typeof ListTracesRequestSchema.Type;

export const GetTraceRequestSchema = Schema.Struct({
  traceId: Schema.String,
});

export type GetTraceRequest = typeof GetTraceRequestSchema.Type;

export class TraceNotFoundErrorSchema extends Schema.TaggedError<TraceNotFoundErrorSchema>()(
  "TraceNotFoundError",
  {
    traceId: Schema.String,
  },
) {}

export class TraceStoreErrorSchema extends Schema.TaggedError<TraceStoreErrorSchema>()(
  "TraceStoreError",
  {
    message: Schema.String,
  },
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
  "cancelled",
);

export type JobStatus = typeof JobStatusSchema.Type;

export const JobModeSchema = Schema.Literal("query", "datasource");

export type JobMode = typeof JobModeSchema.Type;

export const PropertyMappingSchema = Schema.Struct({
  sourceProperty: Schema.String,
  destinationProperty: Schema.NullOr(Schema.String),
});

export type PropertyMapping = typeof PropertyMappingSchema.Type;

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
  failedQueryOffsets: Schema.NullOr(Schema.String), // JSON stringified number[]
  identityFieldNames: Schema.NullOr(Schema.String), // JSON stringified string[] (e.g., ["ID", "Ordinal"])
  startedAt: Schema.NullOr(Schema.String),
  completedAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export type Job = typeof JobSchema.Type;

// Job with derived counts (computed from rows table)
export const JobWithCountsSchema = Schema.Struct({
  ...JobSchema.fields,
  processedRows: Schema.Number,
  successfulRows: Schema.Number,
  failedRowCount: Schema.Number,
});

export type JobWithCounts = typeof JobWithCountsSchema.Type;

// Job with resolved environment names and derived counts for list display
export const JobWithEnvironmentsSchema = Schema.Struct({
  ...JobWithCountsSchema.fields,
  sourceEnvironmentName: Schema.String,
  destEnvironmentName: Schema.String,
});

export type JobWithEnvironments = typeof JobWithEnvironmentsSchema.Type;

// ---------------------
// Row and Attempt Schemas
// ---------------------

export const RowStatusSchema = Schema.Literal("success", "failed");

export type RowStatus = typeof RowStatusSchema.Type;

export const AttemptReasonSchema = Schema.Literal("initial", "auto_retry", "manual_retry");

export type AttemptReason = typeof AttemptReasonSchema.Type;

// Base row schema (matches database)
export const RowSchema = Schema.Struct({
  id: Schema.String,
  jobId: Schema.String,
  rowIndex: Schema.Number,
  status: RowStatusSchema,
  identityElements: Schema.NullOr(Schema.String), // JSON stringified string[]
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

export type Row = typeof RowSchema.Type;

// Row with aggregated attempt info for list display
export const RowWithAttemptsInfoSchema = Schema.Struct({
  ...RowSchema.fields,
  attemptCount: Schema.Number,
  latestAttemptAt: Schema.NullOr(Schema.String),
  latestError: Schema.NullOr(Schema.String),
});

export type RowWithAttemptsInfo = typeof RowWithAttemptsInfoSchema.Type;

// Attempt schema
export const AttemptSchema = Schema.Struct({
  id: Schema.String,
  rowId: Schema.String,
  reason: AttemptReasonSchema,
  success: Schema.Boolean,
  errorMessage: Schema.NullOr(Schema.String),
  identityElements: Schema.NullOr(Schema.String), // JSON stringified string[]
  createdAt: Schema.String,
});

export type Attempt = typeof AttemptSchema.Type;

// Request/Response schemas for row operations
export const GetJobRowsRequestSchema = Schema.Struct({
  jobId: Schema.String,
  status: Schema.optionalWith(RowStatusSchema, { exact: true }),
});

export type GetJobRowsRequest = typeof GetJobRowsRequestSchema.Type;

export const GetJobRowsResponseSchema = Schema.Struct({
  rows: Schema.Array(RowWithAttemptsInfoSchema),
  total: Schema.Number,
});

export type GetJobRowsResponse = typeof GetJobRowsResponseSchema.Type;

export const GetRowAttemptsRequestSchema = Schema.Struct({
  rowId: Schema.String,
});

export type GetRowAttemptsRequest = typeof GetRowAttemptsRequestSchema.Type;

export const RetrySingleRowRequestSchema = Schema.Struct({
  rowId: Schema.String,
});

export const RetrySingleRowResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  row: Schema.NullOr(RowWithAttemptsInfoSchema), // Updated row if still failed, null if success
});

export type RetrySingleRowResponse = typeof RetrySingleRowResponseSchema.Type;

export const CreateJobRequestSchema = Schema.Struct({
  name: Schema.String,
  mode: JobModeSchema,
  sourceEnvironmentId: Schema.String,
  sourceQueryPath: Schema.optionalWith(Schema.String, { exact: true }),
  sourceEntityType: Schema.optionalWith(Schema.String, { exact: true }),
  destEnvironmentId: Schema.String,
  destEntityType: Schema.String,
  mappings: Schema.Array(PropertyMappingSchema),
});

export type CreateJobRequest = typeof CreateJobRequestSchema.Type;

export const CreateJobResponseSchema = Schema.Struct({
  jobId: Schema.String,
});

export type CreateJobResponse = typeof CreateJobResponseSchema.Type;

export const JobIdRequestSchema = Schema.Struct({
  jobId: Schema.String,
});

export type JobIdRequest = typeof JobIdRequestSchema.Type;

export const RunJobResponseSchema = Schema.Struct({
  started: Schema.Boolean,
});

export type RunJobResponse = typeof RunJobResponseSchema.Type;

export const RetryFailedRowsResponseSchema = Schema.Struct({
  retriedCount: Schema.Number,
  successCount: Schema.Number,
  failCount: Schema.Number,
});

export type RetryFailedRowsResponse = typeof RetryFailedRowsResponseSchema.Type;

// Job Error Schemas
export class JobNotFoundErrorSchema extends Schema.TaggedError<JobNotFoundErrorSchema>()(
  "JobNotFoundError",
  {
    jobId: Schema.String,
  },
) {}

export class JobAlreadyRunningErrorSchema extends Schema.TaggedError<JobAlreadyRunningErrorSchema>()(
  "JobAlreadyRunning",
  {
    jobId: Schema.String,
  },
) {}

export class MigrationErrorSchema extends Schema.TaggedError<MigrationErrorSchema>()(
  "MigrationError",
  {
    message: Schema.String,
  },
) {}
