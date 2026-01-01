import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/browse')({
  component: BrowsePage,
})

function BrowsePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Browse</h1>
        <p className="text-muted-foreground">
          Explore data sources and queries from your source IMIS environment.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">Data source browser coming soon...</p>
      </div>
    </div>
  )
}

