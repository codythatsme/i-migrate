// Environment type (no password stored - passwords are kept in memory only)
export type Environment = {
  id: string
  name: string
  baseUrl: string
  username: string
  createdAt: string
  updatedAt: string
}

// Session storage keys
const ENVIRONMENTS_KEY = 'i-migrate:environments'
const SELECTED_ENV_KEY = 'i-migrate:selected-environment-id'

// Generate a unique ID
export function generateId(): string {
  return crypto.randomUUID()
}

// Get all environments from session storage
export function getEnvironments(): Environment[] {
  try {
    const stored = sessionStorage.getItem(ENVIRONMENTS_KEY)
    if (!stored) return []
    return JSON.parse(stored) as Environment[]
  } catch {
    return []
  }
}

// Save environments to session storage
export function saveEnvironments(environments: Environment[]): void {
  sessionStorage.setItem(ENVIRONMENTS_KEY, JSON.stringify(environments))
}

// Get the selected environment ID
export function getSelectedEnvironmentId(): string | null {
  return sessionStorage.getItem(SELECTED_ENV_KEY)
}

// Set the selected environment ID
export function setSelectedEnvironmentId(id: string | null): void {
  if (id === null) {
    sessionStorage.removeItem(SELECTED_ENV_KEY)
  } else {
    sessionStorage.setItem(SELECTED_ENV_KEY, id)
  }
}

// Helper to create a new environment
export function createEnvironment(
  data: Pick<Environment, 'name' | 'baseUrl' | 'username'>
): Environment {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: data.name,
    baseUrl: data.baseUrl,
    username: data.username,
    createdAt: now,
    updatedAt: now,
  }
}

// Helper to update an environment
export function updateEnvironment(
  environment: Environment,
  updates: Partial<Pick<Environment, 'name' | 'baseUrl' | 'username'>>
): Environment {
  return {
    ...environment,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
}

