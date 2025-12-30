// Environment type (no password stored - passwords are kept in memory only)
export type Environment = {
  id: string
  name: string
  baseUrl: string
  username: string
  createdAt: string
  updatedAt: string
}

// Re-export the type from the schema for consistency
// The database schema type should be the source of truth
export type { Environment as EnvironmentDB } from '@/db/schema'
