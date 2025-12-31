import { queryOptions } from "@tanstack/react-query"
import {
  listEnvironments,
  getEnvironment,
  type EnvironmentWithStatus,
} from "@/api/client"

// Query options factory using RPC client
export const queries = {
  environments: {
    // Get all environments (includes hasPassword status from server)
    all: () =>
      queryOptions({
        queryKey: ["environments"],
        queryFn: () => listEnvironments(),
      }),

    // Get a single environment by ID (includes hasPassword status from server)
    byId: (id: string) =>
      queryOptions({
        queryKey: ["environments", id],
        queryFn: () => getEnvironment(id),
        enabled: !!id,
      }),
  },
}
