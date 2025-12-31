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
} from "./schemas"

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
  error: Schema.Union(DatabaseErrorSchema, EnvironmentNotFoundErrorSchema),
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
    ImisResponseErrorSchema
  ),
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
  TestConnection
)

// Export type for the API group
export type ApiGroup = typeof ApiGroup

