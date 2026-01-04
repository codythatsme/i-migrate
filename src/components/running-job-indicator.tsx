import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  AlertCircle,
  ArrowRight,
  Circle,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { queries } from '@/lib/queries'
import type { JobWithEnvironments } from '@/api/client'
import { cn } from '@/lib/utils'

function getProgressPercent(job: JobWithEnvironments) {
  if (!job.totalRows || job.totalRows === 0) return 0
  return Math.round((job.processedRows / job.totalRows) * 100)
}

function getProgressRate(job: JobWithEnvironments) {
  if (job.status !== 'running' || !job.startedAt || job.processedRows === 0) return null
  const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000
  if (elapsed < 1) return null
  const rate = job.processedRows / elapsed
  return rate >= 1 ? `${Math.round(rate)}/sec` : `${(rate * 60).toFixed(1)}/min`
}

export function RunningJobIndicator() {
  const { data: jobs } = useQuery(queries.jobs.all())
  const runningJob = jobs?.find((j) => j.status === 'running')
  const [open, setOpen] = useState(false)

  // Idle state - no job running
  if (!runningJob) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/jobs"
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-muted/50 hover:bg-muted transition-colors',
                'text-sm text-muted-foreground'
              )}
            >
              <Circle className="size-3" />
              <span>Idle</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>No jobs running</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const progress = getProgressPercent(runningJob)
  const rate = getProgressRate(runningJob)
  const hasFailed = runningJob.failedRowCount > 0

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-primary/10 hover:bg-primary/20 transition-colors',
                'text-sm font-medium text-primary'
              )}
            >
              <Loader2 className="size-4 animate-spin" />
              <span className="max-w-[120px] truncate">{runningJob.name}</span>
              <span className="font-mono text-xs">({progress}%)</span>
              {hasFailed && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertCircle className="size-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{runningJob.failedRowCount} failed</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Click for details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            {runningJob.name}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {/* Environment Flow */}
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs text-muted-foreground">Source</span>
              <span className="font-medium text-sm truncate">
                {runningJob.sourceEnvironmentName}
              </span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col flex-1 min-w-0 text-right">
              <span className="text-xs text-muted-foreground">Destination</span>
              <span className="font-medium text-sm truncate">
                {runningJob.destEnvironmentName}
              </span>
            </div>
          </div>

          {/* Progress Section */}
          {runningJob.totalRows !== null && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono">
                  {runningJob.processedRows.toLocaleString()} / {runningJob.totalRows.toLocaleString()} rows
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    hasFailed ? 'bg-amber-500' : 'bg-primary'
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-2xl font-semibold text-primary">{progress}%</span>
                {rate && (
                  <span className="text-muted-foreground font-mono self-end">
                    {rate}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 p-3 bg-green-500/10 rounded-lg">
              <span className="text-xs text-muted-foreground">Successful</span>
              <span className="text-lg font-semibold text-green-600">
                {runningJob.successfulRows.toLocaleString()}
              </span>
            </div>
            <div className={cn(
              'flex flex-col gap-1 p-3 rounded-lg',
              hasFailed ? 'bg-amber-500/10' : 'bg-muted/30'
            )}>
              <span className="text-xs text-muted-foreground">Failed</span>
              <span className={cn(
                'text-lg font-semibold',
                hasFailed ? 'text-amber-600' : 'text-muted-foreground'
              )}>
                {runningJob.failedRowCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Failure Warning */}
          {hasFailed && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="size-4 text-amber-500 shrink-0" />
              <span className="text-sm text-amber-600">
                {runningJob.failedRowCount} row{runningJob.failedRowCount > 1 ? 's' : ''} failed (can retry after completion)
              </span>
            </div>
          )}
        </div>

        <SheetFooter className="px-4">
          <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
            <Link to="/jobs" search={{ status: 'running' }}>
              View full details
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
