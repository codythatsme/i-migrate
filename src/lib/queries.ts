import { queryOptions } from "@tanstack/react-query";
import {
  listEnvironments,
  getEnvironment,
  listDataSources,
  getDocumentByPath,
  getDocumentsInFolder,
  getQueryDefinition,
  listTraces,
  getTrace,
  listJobs,
  getJob,
  getJobRows,
  getRowAttempts,
} from "@/api/client";
import type { RowStatus } from "@/api/client";

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
      fileTypes: string[] = ["FOL", "IQD"],
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

  jobs: {
    // Get all jobs (with derived counts)
    all: () =>
      queryOptions({
        queryKey: ["jobs"],
        queryFn: () => listJobs(),
        refetchInterval: 3000, // Auto-refresh every 3 seconds for progress updates
      }),

    // Get a single job by ID (with derived counts)
    byId: (jobId: string | null) =>
      queryOptions({
        queryKey: ["jobs", jobId],
        queryFn: () => getJob(jobId!),
        enabled: !!jobId,
        refetchInterval: 2000, // More frequent updates for single job view
      }),

    // Get rows for a job (with attempt summary info)
    rows: (jobId: string | null, status?: RowStatus) =>
      queryOptions({
        queryKey: ["jobs", jobId, "rows", status ?? "all"],
        queryFn: () => getJobRows(jobId!, { status }),
        enabled: !!jobId,
      }),

    // Get attempts for a specific row (for inline expansion)
    rowAttempts: (rowId: string | null) =>
      queryOptions({
        queryKey: ["rows", rowId, "attempts"],
        queryFn: () => getRowAttempts(rowId!),
        enabled: !!rowId,
      }),
  },
};
