import { Schema } from "effect"

// ---------------------
// Environment Schemas
// ---------------------

export const EnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  baseUrl: Schema.String,
  username: Schema.String,
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
})

export type CreateEnvironment = typeof CreateEnvironmentSchema.Type

export const UpdateEnvironmentSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.optionalWith(Schema.String, { exact: true }),
  baseUrl: Schema.optionalWith(Schema.String, { exact: true }),
  username: Schema.optionalWith(Schema.String, { exact: true }),
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
  ImisResponseErrorSchema
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

