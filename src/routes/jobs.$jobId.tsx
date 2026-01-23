import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Database,
  FileSearch,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queries } from "@/lib/queries";
import { runJob, retryFailedRows, cancelJob, deleteJob } from "@/api/client";
import type { RowStatus } from "@/api/client";
import {
  StatusIcon,
  StatusBadge,
  formatDuration,
  formatFullDateTime,
  getProgressPercent,
} from "@/components/job-status";
import { JobRowResultsTable } from "@/components/job-row-results-table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/jobs/$jobId")({
  component: JobDetailsPage,
});

type StatusFilter = "all" | "success" | "failed";

function JobDetailsPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const { data: job, isLoading: isLoadingJob } = useQuery(queries.jobs.byId(jobId));

  // Get rows with optional status filter
  const rowStatus: RowStatus | undefined = statusFilter === "all" ? undefined : statusFilter;
  const { data: rowsData, isLoading: isLoadingRows } = useQuery(
    queries.jobs.rows(jobId, rowStatus),
  );

  const identityFieldNames = useMemo(() => {
    if (!job?.identityFieldNames) return [] as string[];
    try {
      return JSON.parse(job.identityFieldNames) as string[];
    } catch {
      return [] as string[];
    }
  }, [job?.identityFieldNames]);

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
      queryClient.invalidateQueries({ queryKey: ["jobs", jobId, "rows"] });
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
      navigate({ to: "/jobs" });
    },
  });

  const handleConfirmDelete = () => {
    deleteMutation.mutate(jobId);
  };

  if (isLoadingJob) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Job not found</p>
        <Button variant="outline" asChild>
          <Link to="/jobs">
            <ArrowLeft className="size-4 mr-2" />
            Back to Jobs
          </Link>
        </Button>
      </div>
    );
  }

  const progress = getProgressPercent(job.processedRows, job.totalRows);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/jobs">
              <ArrowLeft className="size-4 mr-1" />
              Jobs
            </Link>
          </Button>
          <StatusBadge status={job.status} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {job.status === "queued" && (
            <Button
              size="sm"
              onClick={() => runJobMutation.mutate(job.id)}
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
          {job.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelMutation.mutate(job.id)}
              disabled={cancelMutation.isPending}
            >
              <Pause className="size-4 mr-1" />
              Cancel
            </Button>
          )}
          {job.status === "failed" && (
            <Button
              size="sm"
              onClick={() => runJobMutation.mutate(job.id)}
              disabled={runJobMutation.isPending}
            >
              {runJobMutation.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : (
                <RotateCcw className="size-4 mr-1" />
              )}
              Retry Job
            </Button>
          )}
          {job.failedRowCount > 0 &&
            (job.status === "completed" || job.status === "partial" || job.status === "failed") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryMutation.mutate(job.id)}
                disabled={retryMutation.isPending}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="size-4 mr-1" />
                )}
                Retry Failed ({job.failedRowCount})
              </Button>
            )}
          {job.status !== "running" && (
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="size-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Job Summary */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <StatusIcon status={job.status} className="size-5" />
          <h1 className="text-xl font-semibold">{job.name}</h1>
        </div>

        {/* Error Message Banner */}
        {job.status === "failed" && job.errorMessage && (
          <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Validation Failed</p>
              <p className="text-muted-foreground mt-1">{job.errorMessage}</p>
            </div>
          </div>
        )}

        {/* Environment Flow */}
        <div className="flex items-center gap-4 text-sm">
          <span className="px-2 py-1 bg-muted rounded font-medium">
            {job.sourceEnvironmentName}
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="px-2 py-1 bg-muted rounded font-medium">{job.destEnvironmentName}</span>
          <span className="text-muted-foreground ml-auto">
            Duration: {formatDuration(job.startedAt, job.completedAt)}
          </span>
        </div>

        {/* Progress Bar */}
        {job.totalRows !== null && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono">
                {job.processedRows} / {job.totalRows} rows ({progress}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  job.failedRowCount > 0 ? "bg-amber-500" : "bg-primary",
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Timeline & Stats */}
      <Accordion type="single" collapsible className="border rounded-lg">
        <AccordionItem value="details" className="border-0">
          <AccordionTrigger className="px-4 hover:no-underline">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="size-4" />
              Timeline & Stats
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Timeline */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Created</span>
                <span className="text-sm font-mono">{formatFullDateTime(job.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Started</span>
                <span className="text-sm font-mono">{formatFullDateTime(job.startedAt)}</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Completed</span>
                <span className="text-sm font-mono">{formatFullDateTime(job.completedAt)}</span>
              </div>

              {/* Stats */}
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Mode</span>
                <span className="text-sm flex items-center gap-1.5">
                  {job.mode === "query" ? (
                    <FileSearch className="size-3.5" />
                  ) : (
                    <Database className="size-3.5" />
                  )}
                  {job.mode === "query" ? "Query" : "Data Source"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground font-medium">Mappings</span>
                <span className="text-sm font-mono">
                  {(() => {
                    try {
                      const mappings = JSON.parse(job.mappings) as Array<{
                        destinationProperty: string | null;
                      }>;
                      const active = mappings.filter((m) => m.destinationProperty !== null).length;
                      return `${active} fields`;
                    } catch {
                      return "—";
                    }
                  })()}
                </span>
              </div>
              {job.status === "running" && job.startedAt && job.processedRows > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-primary font-medium">Processing Rate</span>
                  <span className="text-sm font-mono text-primary">
                    {(() => {
                      const elapsed = (Date.now() - new Date(job.startedAt!).getTime()) / 1000;
                      if (elapsed < 1) return "—";
                      const rate = job.processedRows / elapsed;
                      return rate >= 1
                        ? `${Math.round(rate)}/sec`
                        : `${(rate * 60).toFixed(1)}/min`;
                    })()}
                  </span>
                </div>
              )}

              {/* Source/Dest info */}
              <div className="col-span-2 md:col-span-3 flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                <span className="font-mono truncate flex-1">
                  {job.mode === "query" ? job.sourceQueryPath : job.sourceEntityType}
                </span>
                <ArrowRight className="size-3 shrink-0" />
                <span className="font-mono truncate flex-1">{job.destEntityType}</span>
              </div>

              {/* Job ID */}
              <div className="col-span-2 md:col-span-3 text-[10px] text-muted-foreground/60 font-mono">
                ID: {job.id}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Row Results Table */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Row Results</h2>

        <JobRowResultsTable
          rows={rowsData?.rows}
          total={rowsData?.total ?? 0}
          identityFieldNames={identityFieldNames}
          jobId={jobId}
          isLoading={isLoadingRows}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
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
              Are you sure you want to delete "{job.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {job.status === "partial" && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Warning: Partial Job</p>
                <p className="text-muted-foreground mt-1">
                  This job has {job.failedRowCount} failed records that haven't been retried.
                  Deleting will permanently remove these records and you won't be able to retry
                  them.
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
