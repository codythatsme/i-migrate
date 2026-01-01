import { createFileRoute } from '@tanstack/react-router'

type ExportSearch = {
  from?: 'datasource' | 'query'
}

export const Route = createFileRoute('/export')({
  validateSearch: (search: Record<string, unknown>): ExportSearch => {
    return {
      from: search.from === 'datasource' || search.from === 'query' ? search.from : undefined,
    }
  },
  component: ExportPage,
})

function ExportPage() {
  const { from } = Route.useSearch()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Export data from your source IMIS environment.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-8">
        <p className="text-muted-foreground">
          URL parameter: <code className="px-2 py-1 rounded bg-muted font-mono text-foreground">{from ?? 'none'}</code>
        </p>
      </div>
    </div>
  )
}

