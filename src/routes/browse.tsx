import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/browse')({
  component: BrowsePage,
})

function BrowsePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Browse</h1>
        <p className="text-zinc-400">
          Explore data sources and queries from your source IMIS environment.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-zinc-500">Data source browser coming soon...</p>
      </div>
    </div>
  )
}

