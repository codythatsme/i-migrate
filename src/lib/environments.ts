// Re-export types from the API schemas for consistency
// The API schemas are now the source of truth for these types

// Environment represents the base database record
export type { Environment as EnvironmentDB } from "@/api/schemas"

// EnvironmentWithStatus includes hasPassword flag (this is what the API returns)
export type { EnvironmentWithStatus } from "@/api/schemas"

// For backward compatibility, Environment type now includes hasPassword
// since that's what the list and get endpoints return
export type { EnvironmentWithStatus as Environment } from "@/api/schemas"
