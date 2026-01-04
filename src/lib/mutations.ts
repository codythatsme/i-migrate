import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queries } from "./queries"
import {
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  setPassword,
  clearPassword,
  testConnection,
  type Environment,
  type CreateEnvironment,
} from "@/api/client"

// Types for mutation inputs
type UpdateEnvironmentInput = {
  id: string
  updates: Partial<Pick<Environment, "name" | "baseUrl" | "username" | "version" | "queryConcurrency" | "insertConcurrency">>
}

// Create environment mutation
export const useCreateEnvironment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEnvironment) => createEnvironment(data),
    onSuccess: () => {
      queryClient.invalidateQueries(queries.environments.all())
    },
  })
}

// Update environment mutation
export const useUpdateEnvironment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: UpdateEnvironmentInput) =>
      updateEnvironment({ id, ...updates }),
    onSuccess: (data) => {
      // Invalidate both queries to refresh with hasPassword status
      queryClient.invalidateQueries(queries.environments.all())
      queryClient.invalidateQueries(queries.environments.byId(data.id))
    },
  })
}

// Delete environment mutation
export const useDeleteEnvironment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteEnvironment(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries(queries.environments.all())
      queryClient.removeQueries(queries.environments.byId(id))
    },
  })
}

// ============================================
// Password Mutations (server-side storage)
// ============================================

// Set password for an environment (stored server-side in memory)
export const useSetPassword = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      environmentId,
      password,
    }: {
      environmentId: string
      password: string
    }) => setPassword(environmentId, password),
    onSuccess: () => {
      // Invalidate environments query to refresh hasPassword status from server
      queryClient.invalidateQueries(queries.environments.all())
    },
  })
}

// Clear password for an environment
export const useClearPassword = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (environmentId: string) => clearPassword(environmentId),
    onSuccess: () => {
      // Invalidate environments query to refresh hasPassword status from server
      queryClient.invalidateQueries(queries.environments.all())
    },
  })
}

// ============================================
// Connection Test Mutations
// ============================================

// Test connection to an IMIS environment
export const useTestConnection = () => {
  return useMutation({
    mutationFn: (environmentId: string) => testConnection(environmentId),
  })
}
