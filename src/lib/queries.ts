import { queryOptions } from "@tanstack/react-query"
import {
  listEnvironments,
  getEnvironment,
  listDataSources,
  getDocumentByPath,
  getDocumentsInFolder,
  getQueryDefinition,
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
}
