import { queryOptions } from "@tanstack/react-query"
import {
  listEnvironments,
  getEnvironment,
  listDataSources,
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

  dataSources: {
    // Get all data sources (BoEntityDefinitions) from an environment
    byEnvironment: (environmentId: string | null) =>
      queryOptions({
        queryKey: ["datasources", environmentId],
        queryFn: () => listDataSources(environmentId!),
        enabled: !!environmentId,
      }),
  },
}
