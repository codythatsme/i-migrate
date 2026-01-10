import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronRight,
  Clock,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queries } from "@/lib/queries";
import {
  StatusIcon,
  formatDuration,
  formatRelativeTime,
  getProgressPercent,
} from "@/components/job-status";
import type { JobWithEnvironments, JobStatus } from "@/api/client";
import { cn } from "@/lib/utils";

type JobsSearch = {
  status?: JobStatus | "all";
};

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
  validateSearch: (search: Record<string, unknown>): JobsSearch => ({
    status: (search.status as JobStatus | "all") || "all",
  }),
});

function JobsPage() {
  const navigate = useNavigate({ from: "/jobs" });
  const { status: statusFilter } = Route.useSearch();

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
      return { total: 0, completed: 0, partial: 0, failed: 0, running: 0 };
    }
    const completed = jobs.filter((j) => j.status === "completed").length;
    const partial = jobs.filter((j) => j.status === "partial").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const running = jobs.filter((j) => j.status === "running").length;
    return { total: jobs.length, completed, partial, failed, running };
  }, [jobs]);

  const setStatusFilter = (status: JobStatus | "all") => {
    navigate({
      search: (prev) => ({ ...prev, status: status === "all" ? undefined : status }),
    });
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        </div>
      )}

      {/* Job List */}
      <Card>
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

        <CardContent className="p-0">
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
                <JobListItem key={job.id} job={job} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobListItem({ job }: { job: JobWithEnvironments }) {
  const progress = getProgressPercent(job.processedRows, job.totalRows);

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
    <Link
      to="/jobs/$jobId"
      params={{ jobId: job.id }}
      className="block w-full px-4 py-3 text-left transition-colors hover:bg-accent/50"
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
    </Link>
  );
}
