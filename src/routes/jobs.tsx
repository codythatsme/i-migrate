import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/jobs')({
  component: JobsPage,
})

function JobsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-zinc-400">
          Queue mappings for import and track job progress with per-row results.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-zinc-500">Job runner coming soon...</p>
      </div>
    </div>
  )
}

