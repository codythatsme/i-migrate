import { useState, useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Play,
  RotateCcw,
  XCircle,
  Pause,
  Database,
  ArrowRight,
  FileSearch,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { queries } from "@/lib/queries";
import { runJob, retryFailedRows, cancelJob, deleteJob } from "@/api/client";
import type { JobWithEnvironments, FailedRow, SuccessRow, JobStatus } from "@/api/client";
import { cn } from "@/lib/utils";

type JobsSearch = {
  status?: JobStatus | "all";
};

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  validateSearch: (search: Record<string, unknown>): JobsSearch => ({
    status: (search.status as JobStatus | "all") || "all",
  }),
});

function JobsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/jobs" });
  const { status: statusFilter } = Route.useSearch();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<JobWithEnvironments | null>(null);
  const [rowResultsLimit, setRowResultsLimit] = useState(100);

  const { data: jobs, isLoading, refetch, isFetching } = useQuery(queries.jobs.all());

  // Filter jobs by status
  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (!statusFilter || statusFilter === "all") return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  // Compute job stats
  const jobStats = useMemo(() => {
    if (!jobs || jobs.length === 0) {
      return { total: 0, completed: 0, partial: 0, failed: 0, running: 0, successRate: 0 };
    }
    const completed = jobs.filter((j) => j.status === "completed").length;
    const partial = jobs.filter((j) => j.status === "partial").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const running = jobs.filter((j) => j.status === "running").length;
    const finished = completed + partial + failed;
    const successRate = finished > 0 ? Math.round((completed / finished) * 100) : 0;
    return { total: jobs.length, completed, partial, failed, running, successRate };
  }, [jobs]);

  const setStatusFilter = (status: JobStatus | "all") => {
    navigate({
      search: (prev) => ({ ...prev, status: status === "all" ? undefined : status }),
    });
  };
  const { data: selectedJob } = useQuery(queries.jobs.byId(selectedJobId));
  const { data: failedRows } = useQuery(queries.jobs.failedRows(selectedJobId));
  const { data: successRows } = useQuery(queries.jobs.successRows(selectedJobId));

  // Parse identity field names from the job
  const identityFieldNames = useMemo(() => {
    if (!selectedJob?.identityFieldNames) return [] as string[];
    try {
      return JSON.parse(selectedJob.identityFieldNames) as string[];
    } catch {
      return [] as string[];
    }
  }, [selectedJob?.identityFieldNames]);

  // Create combined timeline of success and failed rows sorted by rowIndex
  const rowResults = useMemo(() => {
    const results: Array<
      { type: "success"; row: SuccessRow } | { type: "failure"; row: FailedRow }
    > = [];

    if (successRows) {
      results.push(...successRows.map((row) => ({ type: "success" as const, row })));
    }
    if (failedRows) {
      results.push(...failedRows.map((row) => ({ type: "failure" as const, row })));
    }

    // Sort by rowIndex
    return results.sort((a, b) => a.row.rowIndex - b.row.rowIndex);
  }, [successRows, failedRows]);

  const runJobMutation = useMutation({
    mutationFn: runJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: retryFailedRows,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs", selectedJobId, "failedRows"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setSelectedJobId(null);
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    },
  });

  const handleDeleteClick = (job: JobWithEnvironments) => {
    setJobToDelete(job);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (jobToDelete) {
      deleteMutation.mutate(jobToDelete.id);
    }
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return "—";
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const ms = end - start;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now();
    const date = new Date(timestamp).getTime();
    const diff = now - date;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatFullDateTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);
  };

  const getProgressPercent = (job: JobWithEnvironments) => {
    if (!job.totalRows || job.totalRows === 0) return 0;
    return Math.round((job.processedRows / job.totalRows) * 100);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground text-sm">
            Track migration job progress and retry failed records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {jobs && jobs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col p-3 bg-muted/30 rounded-lg">
            <span className="text-xs text-muted-foreground">Total Jobs</span>
            <span className="text-xl font-semibold">{jobStats.total}</span>
          </div>
          <div className="flex flex-col p-3 bg-green-500/10 rounded-lg">
            <span className="text-xs text-green-600">Completed</span>
            <span className="text-xl font-semibold text-green-600">{jobStats.completed}</span>
          </div>
          <div className="flex flex-col p-3 bg-amber-500/10 rounded-lg">
            <span className="text-xs text-amber-600">Partial</span>
            <span className="text-xl font-semibold text-amber-600">{jobStats.partial}</span>
          </div>
          <div className="flex flex-col p-3 bg-destructive/10 rounded-lg">
            <span className="text-xs text-destructive">Failed</span>
            <span className="text-xl font-semibold text-destructive">{jobStats.failed}</span>
          </div>
          <div className="flex flex-col p-3 bg-primary/10 rounded-lg">
            <span className="text-xs text-primary">Success Rate</span>
            <span className="text-xl font-semibold text-primary">{jobStats.successRate}%</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
        {/* Job List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Database className="size-4" />
              Migration Jobs
              {jobs && (
                <span className="text-muted-foreground font-normal">
                  ({filteredJobs.length}
                  {statusFilter && statusFilter !== "all" ? ` of ${jobs.length}` : ""})
                </span>
              )}
            </CardTitle>
          </CardHeader>

          {/* Status Filters */}
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {(
              ["all", "completed", "partial", "failed", "running", "queued", "cancelled"] as const
            ).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-full transition-colors",
                  (statusFilter || "all") === status
                    ? status === "all"
                      ? "bg-primary text-primary-foreground"
                      : status === "completed"
                        ? "bg-green-500/20 text-green-600 ring-1 ring-green-500/30"
                        : status === "partial"
                          ? "bg-amber-500/20 text-amber-600 ring-1 ring-amber-500/30"
                          : status === "failed"
                            ? "bg-destructive/20 text-destructive ring-1 ring-destructive/30"
                            : status === "running"
                              ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                              : "bg-muted text-muted-foreground ring-1 ring-muted-foreground/30"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !jobs?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Database className="size-8 mb-2 opacity-50" />
                <p className="text-sm">No jobs yet</p>
                <p className="text-xs">Create a migration from the Export page</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">No {statusFilter} jobs found</p>
                <button
                  onClick={() => setStatusFilter("all")}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Show all jobs
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {filteredJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isSelected={selectedJobId === job.id}
                    onSelect={() => {
                      setSelectedJobId(job.id);
                      setRowResultsLimit(100); // Reset limit when selecting a new job
                    }}
                    formatDuration={formatDuration}
                    formatRelativeTime={formatRelativeTime}
                    getProgressPercent={getProgressPercent}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job Details */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {!selectedJobId ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">Select a job to view details</p>
              </div>
            ) : !selectedJob ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-4">
                {/* Job Summary */}
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={selectedJob.status} />
                      <span className="font-medium">{selectedJob.name}</span>
                    </div>
                    <StatusBadge status={selectedJob.status} />
                  </div>

                  {/* Environment Flow */}
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-xs text-muted-foreground">Source</span>
                      <span className="font-medium truncate">
                        {selectedJob.sourceEnvironmentName}
                      </span>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0 text-right">
                      <span className="text-xs text-muted-foreground">Destination</span>
                      <span className="font-medium truncate">
                        {selectedJob.destEnvironmentName}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {selectedJob.totalRows !== null && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-mono">
                          {selectedJob.processedRows} / {selectedJob.totalRows} rows (
                          {getProgressPercent(selectedJob)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            selectedJob.failedRowCount > 0 ? "bg-amber-500" : "bg-primary",
                          )}
                          style={{ width: `${getProgressPercent(selectedJob)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg cursor-help">
                            <span className="text-xs text-muted-foreground">Successful</span>
                            <span className="text-lg font-semibold text-green-600">
                              {selectedJob.successfulRows}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Rows successfully inserted</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg cursor-help">
                            <span className="text-xs text-muted-foreground">Failed</span>
                            <span className="text-lg font-semibold text-destructive">
                              {selectedJob.failedRowCount}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Rows that failed to insert (can be retried)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg cursor-help">
                            <span className="text-xs text-muted-foreground">Duration</span>
                            <span className="text-sm font-mono">
                              {formatDuration(selectedJob.startedAt, selectedJob.completedAt)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total execution time</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg cursor-help">
                            <span className="text-xs text-muted-foreground">Mode</span>
                            <span className="text-sm flex items-center gap-1.5">
                              {selectedJob.mode === "query" ? (
                                <FileSearch className="size-3.5" />
                              ) : (
                                <Database className="size-3.5" />
                              )}
                              {selectedJob.mode === "query" ? "Query" : "Data Source"}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {selectedJob.mode === "query"
                              ? "Source data from IQD query"
                              : "Source data from Business Object"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg cursor-help">
                            <span className="text-xs text-muted-foreground">Mappings</span>
                            <span className="text-sm font-mono">
                              {(() => {
                                try {
                                  const mappings = JSON.parse(selectedJob.mappings) as Array<{
                                    destinationProperty: string | null;
                                  }>;
                                  const active = mappings.filter(
                                    (m) => m.destinationProperty !== null,
                                  ).length;
                                  return `${active} fields`;
                                } catch {
                                  return "—";
                                }
                              })()}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Number of field mappings configured</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {selectedJob.status === "running" &&
                      selectedJob.startedAt &&
                      selectedJob.processedRows > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col gap-1 p-3 bg-primary/10 rounded-lg cursor-help">
                                <span className="text-xs text-primary">Rate</span>
                                <span className="text-sm font-mono text-primary">
                                  {(() => {
                                    const elapsed =
                                      (Date.now() - new Date(selectedJob.startedAt!).getTime()) /
                                      1000;
                                    if (elapsed < 1) return "—";
                                    const rate = selectedJob.processedRows / elapsed;
                                    return rate >= 1
                                      ? `${Math.round(rate)}/sec`
                                      : `${(rate * 60).toFixed(1)}/min`;
                                  })()}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Current processing rate</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                  </div>

                  {/* Source/Destination Data Info */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
                    <span className="font-mono text-xs truncate flex-1">
                      {selectedJob.mode === "query"
                        ? selectedJob.sourceQueryPath
                        : selectedJob.sourceEntityType}
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">
                      {selectedJob.destEntityType}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="flex flex-col gap-2 p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="size-4 text-muted-foreground" />
                      Timeline
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Created</span>
                        <span className="font-mono text-xs">
                          {formatFullDateTime(selectedJob.createdAt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Started</span>
                        <span className="font-mono text-xs">
                          {formatFullDateTime(selectedJob.startedAt)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-mono text-xs">
                          {formatFullDateTime(selectedJob.completedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mb-4">
                  {selectedJob.status === "queued" && (
                    <Button
                      size="sm"
                      onClick={() => runJobMutation.mutate(selectedJob.id)}
                      disabled={runJobMutation.isPending}
                    >
                      {runJobMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      ) : (
                        <Play className="size-4 mr-1" />
                      )}
                      Run Job
                    </Button>
                  )}
                  {selectedJob.status === "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelMutation.mutate(selectedJob.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <Pause className="size-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                  {selectedJob.failedRowCount > 0 &&
                    (selectedJob.status === "completed" ||
                      selectedJob.status === "partial" ||
                      selectedJob.status === "failed") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retryMutation.mutate(selectedJob.id)}
                        disabled={retryMutation.isPending}
                      >
                        {retryMutation.isPending ? (
                          <Loader2 className="size-4 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="size-4 mr-1" />
                        )}
                        Retry Failed ({selectedJob.failedRowCount})
                      </Button>
                    )}
                  {selectedJob.status !== "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(selectedJob)}
                    >
                      <Trash2 className="size-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Row Results */}
                {(selectedJob.successfulRows > 0 || selectedJob.failedRowCount > 0) && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      Row Results
                      {successRows && successRows.length > 0 && (
                        <span className="text-green-600 text-xs">
                          ({successRows.length} success)
                        </span>
                      )}
                      {failedRows && failedRows.length > 0 && (
                        <span className="text-destructive text-xs">
                          ({failedRows.length} failed)
                        </span>
                      )}
                    </h4>
                    {!successRows && !failedRows ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : rowResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No row results to display</p>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-64 overflow-auto">
                        {rowResults
                          .slice(0, rowResultsLimit)
                          .map((result) =>
                            result.type === "success" ? (
                              <SuccessRowItem
                                key={`s-${result.row.id}`}
                                row={result.row}
                                identityFieldNames={identityFieldNames}
                              />
                            ) : (
                              <FailedRowItem key={`f-${result.row.id}`} row={result.row} />
                            ),
                          )}
                        {rowResults.length > rowResultsLimit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setRowResultsLimit((prev) => prev + 100)}
                          >
                            Load next 100 ({rowResults.length - rowResultsLimit} remaining)
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Delete Job
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{jobToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {jobToDelete?.status === "partial" && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Warning: Partial Job</p>
                <p className="text-muted-foreground mt-1">
                  This job has {jobToDelete.failedRowCount} failed records that haven't been
                  retried. Deleting will permanently remove these records and you won't be able to
                  retry them.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="size-4 mr-1" />
              )}
              Delete Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------
// Sub-components
// ---------------------

function StatusIcon({ status, className }: { status: JobStatus; className?: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle className={cn("size-4 text-green-600", className)} />;
    case "failed":
      return <XCircle className={cn("size-4 text-destructive", className)} />;
    case "partial":
      return <AlertCircle className={cn("size-4 text-amber-500", className)} />;
    case "cancelled":
      return <XCircle className={cn("size-4 text-muted-foreground", className)} />;
    case "running":
      return <Loader2 className={cn("size-4 animate-spin text-primary", className)} />;
    case "queued":
    default:
      return <Clock className={cn("size-4 text-muted-foreground", className)} />;
  }
}

function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
    running: { label: "Running", className: "bg-primary/10 text-primary" },
    completed: { label: "Completed", className: "bg-green-500/10 text-green-600" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
    partial: { label: "Partial", className: "bg-amber-500/10 text-amber-600" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status];

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", className)}>{label}</span>
  );
}

function JobListItem({
  job,
  isSelected,
  onSelect,
  formatDuration,
  formatRelativeTime,
  getProgressPercent,
}: {
  job: JobWithEnvironments;
  isSelected: boolean;
  onSelect: () => void;
  formatDuration: (start: string | null, end: string | null) => string;
  formatRelativeTime: (ts: string) => string;
  getProgressPercent: (job: JobWithEnvironments) => number;
}) {
  const progress = getProgressPercent(job);

  // Calculate progress rate for running jobs
  const getProgressRate = () => {
    if (job.status !== "running" || !job.startedAt || job.processedRows === 0) return null;
    const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
    if (elapsed < 1) return null;
    const rate = job.processedRows / elapsed;
    return rate >= 1 ? `${Math.round(rate)}/s` : `${(rate * 60).toFixed(1)}/min`;
  };

  const progressRate = getProgressRate();

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-4 py-3 text-left transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={job.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{job.name}</span>
          </div>
          {/* Environment badges */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium truncate max-w-[100px]">
              {job.sourceEnvironmentName}
            </span>
            <ArrowRight className="size-3 text-muted-foreground shrink-0" />
            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-medium truncate max-w-[100px]">
              {job.destEnvironmentName}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatRelativeTime(job.createdAt)}
            </span>
            {job.status !== "queued" && (
              <span className="font-mono">{formatDuration(job.startedAt, job.completedAt)}</span>
            )}
            {job.totalRows !== null && <span>{progress}%</span>}
            {progressRate && <span className="text-primary font-mono">{progressRate}</span>}
          </div>
          {/* Compact progress bar */}
          {job.status === "running" && job.totalRows !== null && (
            <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {job.failedRowCount > 0 && (
            <div className="text-xs text-amber-500 mt-1">{job.failedRowCount} failed records</div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
}

function SuccessRowItem({
  row,
  identityFieldNames,
}: {
  row: SuccessRow;
  identityFieldNames: string[];
}) {
  // Parse identity elements from JSON string
  let identityElements: string[] = [];
  try {
    identityElements = JSON.parse(row.identityElements);
  } catch {
    identityElements = [];
  }

  // Format identity display: "ID: 23204, Ordinal: 21" or "23204, 21" if no field names
  const identityDisplay = identityElements
    .map((value, i) => {
      const fieldName = identityFieldNames[i];
      return fieldName ? `${fieldName}: ${value}` : value;
    })
    .join(", ");

  return (
    <div className="flex items-start gap-2 p-2 bg-green-500/10 rounded text-xs">
      <CheckCircle className="size-3.5 text-green-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">Row #{row.rowIndex + 1}</div>
        {identityDisplay && <div className="text-muted-foreground">{identityDisplay}</div>}
      </div>
    </div>
  );
}

function FailedRowItem({ row }: { row: FailedRow }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded text-xs">
      <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">Row #{row.rowIndex + 1}</div>
        <div className="text-muted-foreground truncate">{row.errorMessage}</div>
        <div className="text-muted-foreground">
          Retries: {row.retryCount} • Status: {row.status}
        </div>
      </div>
    </div>
  );
}
