import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/jobs')({
  component: JobsPage,
})

function JobsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Queue mappings for import and track job progress with per-row results.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">Job runner coming soon...</p>
      </div>
    </div>
  )
}

