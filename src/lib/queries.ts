import { queryOptions } from "@tanstack/react-query"
import type { Environment } from "./environments"

// API fetch helpers
const fetchJson = async <T>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// Password status response type
type PasswordStatus = {
  hasPassword: boolean
}

// Query options factory
export const queries = {
  environments: {
    // Get all environments
    all: () =>
      queryOptions({
        queryKey: ["environments"],
        queryFn: () => fetchJson<Environment[]>("/api/environments"),
      }),

    // Get a single environment by ID
    byId: (id: string) =>
      queryOptions({
        queryKey: ["environments", id],
        queryFn: () => fetchJson<Environment>(`/api/environments/${id}`),
        enabled: !!id,
      }),

    // Check if password is set for an environment (server-side storage)
    passwordStatus: (id: string) =>
      queryOptions({
        queryKey: ["environments", id, "passwordStatus"],
        queryFn: () => fetchJson<PasswordStatus>(`/api/environments/${id}/password/status`),
        enabled: !!id,
        // Don't refetch too often since password status rarely changes
        staleTime: 30_000,
      }),
  },
}

