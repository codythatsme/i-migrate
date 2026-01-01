import { queryOptions } from "@tanstack/react-query"
import {
  listEnvironments,
  getEnvironment,
  listDataSources,
  getDocumentByPath,
  getDocumentsInFolder,
  getQueryDefinition,
  listTraces,
  getTrace,
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

  documents: {
    // Get a document summary by path
    byPath: (environmentId: string | null, path: string | null) =>
      queryOptions({
        queryKey: ["documents", "byPath", environmentId, path],
        queryFn: () => getDocumentByPath(environmentId!, path!),
        enabled: !!environmentId && !!path,
      }),

    // Get all documents in a folder
    inFolder: (
      environmentId: string | null,
      folderId: string | null,
      fileTypes: string[] = ["FOL", "IQD"]
    ) =>
      queryOptions({
        queryKey: ["documents", "inFolder", environmentId, folderId, fileTypes],
        queryFn: () => getDocumentsInFolder(environmentId!, folderId!, fileTypes),
        enabled: !!environmentId && !!folderId,
      }),
  },

  queryDefinition: {
    // Get a query definition by path
    byPath: (environmentId: string | null, path: string | null) =>
      queryOptions({
        queryKey: ["queryDefinition", environmentId, path],
        queryFn: () => getQueryDefinition(environmentId!, path!),
        enabled: !!environmentId && !!path,
      }),
  },

  traces: {
    // Get all recent traces
    all: (limit?: number, offset?: number) =>
      queryOptions({
        queryKey: ["traces", limit, offset],
        queryFn: () => listTraces(limit, offset),
        refetchInterval: 5000, // Auto-refresh every 5 seconds
      }),

    // Get a single trace with all spans
    byId: (traceId: string | null) =>
      queryOptions({
        queryKey: ["traces", traceId],
        queryFn: () => getTrace(traceId!),
        enabled: !!traceId,
      }),
  },
}
