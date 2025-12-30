import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queries } from "./queries"
import type { Environment } from "./environments"

// API mutation helpers
const postJson = async <T>(url: string, data: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

const putJson = async <T>(url: string, data: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

const deleteRequest = async (url: string): Promise<void> => {
  const res = await fetch(url, { method: "DELETE" })
  if (!res.ok && res.status !== 204) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
}

// Types for mutation inputs
type CreateEnvironmentInput = Pick<Environment, "name" | "baseUrl" | "username">

type UpdateEnvironmentInput = {
  id: string
  updates: Partial<Pick<Environment, "name" | "baseUrl" | "username">>
}

// Create environment mutation
export const useCreateEnvironment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEnvironmentInput) =>
      postJson<Environment>("/api/environments", data),
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
      putJson<Environment>(`/api/environments/${id}`, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries(queries.environments.all())
      queryClient.setQueryData(queries.environments.byId(data.id).queryKey, data)
    },
  })
}

// Delete environment mutation
export const useDeleteEnvironment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRequest(`/api/environments/${id}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries(queries.environments.all())
      queryClient.removeQueries(queries.environments.byId(id))
    },
  })
}
