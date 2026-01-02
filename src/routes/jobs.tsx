import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
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
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { queries } from '@/lib/queries'
import { runJob, retryFailedRows, cancelJob } from '@/api/client'
import type { Job, FailedRow, JobStatus } from '@/api/client'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/jobs')({
  component: JobsPage,
})

function JobsPage() {
  const queryClient = useQueryClient()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const { data: jobs, isLoading, refetch, isFetching } = useQuery(queries.jobs.all())
  const { data: selectedJob } = useQuery(queries.jobs.byId(selectedJobId))
  const { data: failedRows } = useQuery(queries.jobs.failedRows(selectedJobId))

  const runJobMutation = useMutation({
    mutationFn: runJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const retryMutation = useMutation({
    mutationFn: retryFailedRows,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs', selectedJobId, 'failedRows'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return '—'
    const start = new Date(startedAt).getTime()
    const end = completedAt ? new Date(completedAt).getTime() : Date.now()
    const ms = end - start
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now()
    const date = new Date(timestamp).getTime()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(timestamp).toLocaleDateString()
  }

  const getProgressPercent = (job: Job) => {
    if (!job.totalRows || job.totalRows === 0) return 0
    return Math.round((job.processedRows / job.totalRows) * 100)
  }

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
        {/* Job List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Database className="size-4" />
              Migration Jobs
              {jobs && (
                <span className="text-muted-foreground font-normal">
                  ({jobs.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
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
            ) : (
              <div className="divide-y">
                {jobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isSelected={selectedJobId === job.id}
                    onSelect={() => setSelectedJobId(job.id)}
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

                  {/* Progress Bar */}
                  {selectedJob.totalRows !== null && (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-mono">
                          {selectedJob.processedRows} / {selectedJob.totalRows} rows
                          ({getProgressPercent(selectedJob)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-500',
                            selectedJob.failedRowCount > 0 ? 'bg-amber-500' : 'bg-primary'
                          )}
                          style={{ width: `${getProgressPercent(selectedJob)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Successful</span>
                      <span className="text-lg font-semibold text-green-600">
                        {selectedJob.successfulRows}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Failed</span>
                      <span className="text-lg font-semibold text-destructive">
                        {selectedJob.failedRowCount}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Duration</span>
                      <span className="text-sm font-mono">
                        {formatDuration(selectedJob.startedAt, selectedJob.completedAt)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <span className="text-xs text-muted-foreground">Mode</span>
                      <span className="text-sm flex items-center gap-1.5">
                        {selectedJob.mode === 'query' ? (
                          <FileSearch className="size-3.5" />
                        ) : (
                          <Database className="size-3.5" />
                        )}
                        {selectedJob.mode === 'query' ? 'Query' : 'Data Source'}
                      </span>
                    </div>
                  </div>

                  {/* Source/Destination Info */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/20 rounded-lg">
                    <span className="font-mono text-xs truncate flex-1">
                      {selectedJob.mode === 'query'
                        ? selectedJob.sourceQueryPath
                        : selectedJob.sourceEntityType}
                    </span>
                    <ArrowRight className="size-4 shrink-0" />
                    <span className="font-mono text-xs truncate flex-1">
                      {selectedJob.destEntityType}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mb-4">
                  {selectedJob.status === 'queued' && (
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
                  {selectedJob.status === 'running' && (
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
                    (selectedJob.status === 'completed' ||
                      selectedJob.status === 'partial' ||
                      selectedJob.status === 'failed') && (
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
                </div>

                <Separator className="my-4" />

                {/* Failed Rows */}
                {selectedJob.failedRowCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-medium">
                      Failed Records ({failedRows?.length ?? 0})
                    </h4>
                    {!failedRows ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : failedRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No failed records to display
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1 max-h-64 overflow-auto">
                        {failedRows.slice(0, 50).map((row) => (
                          <FailedRowItem key={row.id} row={row} />
                        ))}
                        {failedRows.length > 50 && (
                          <p className="text-xs text-muted-foreground text-center py-2">
                            ... and {failedRows.length - 50} more
                          </p>
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
    </div>
  )
}

// ---------------------
// Sub-components
// ---------------------

function StatusIcon({ status, className }: { status: JobStatus; className?: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className={cn('size-4 text-green-600', className)} />
    case 'failed':
      return <XCircle className={cn('size-4 text-destructive', className)} />
    case 'partial':
      return <AlertCircle className={cn('size-4 text-amber-500', className)} />
    case 'cancelled':
      return <XCircle className={cn('size-4 text-muted-foreground', className)} />
    case 'running':
      return <Loader2 className={cn('size-4 animate-spin text-primary', className)} />
    case 'queued':
    default:
      return <Clock className={cn('size-4 text-muted-foreground', className)} />
  }
}

function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; className: string }> = {
    queued: { label: 'Queued', className: 'bg-muted text-muted-foreground' },
    running: { label: 'Running', className: 'bg-primary/10 text-primary' },
    completed: { label: 'Completed', className: 'bg-green-500/10 text-green-600' },
    failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
    partial: { label: 'Partial', className: 'bg-amber-500/10 text-amber-600' },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground' },
  }
  const { label, className } = config[status]

  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        className
      )}
    >
      {label}
    </span>
  )
}

function JobListItem({
  job,
  isSelected,
  onSelect,
  formatDuration,
  formatRelativeTime,
  getProgressPercent,
}: {
  job: Job
  isSelected: boolean
  onSelect: () => void
  formatDuration: (start: string | null, end: string | null) => string
  formatRelativeTime: (ts: string) => string
  getProgressPercent: (job: Job) => number
}) {
  const progress = getProgressPercent(job)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full px-4 py-3 text-left transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={job.status} />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{job.name}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatRelativeTime(job.createdAt)}
            </span>
            {job.status !== 'queued' && (
              <span className="font-mono">
                {formatDuration(job.startedAt, job.completedAt)}
              </span>
            )}
            {job.totalRows !== null && (
              <span>{progress}%</span>
            )}
          </div>
          {/* Compact progress bar */}
          {job.status === 'running' && job.totalRows !== null && (
            <div className="h-1 bg-muted rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {job.failedRowCount > 0 && (
            <div className="text-xs text-amber-500 mt-1">
              {job.failedRowCount} failed records
            </div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  )
}

function FailedRowItem({ row }: { row: FailedRow }) {
  return (
    <div className="flex items-start gap-2 p-2 bg-muted/30 rounded text-xs">
      <AlertCircle className="size-3.5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium">Row #{row.rowIndex + 1}</div>
        <div className="text-muted-foreground truncate">{row.errorMessage}</div>
        <div className="text-muted-foreground">
          Retries: {row.retryCount} • Status: {row.status}
        </div>
      </div>
    </div>
  )
}
