import { createFileRoute, Link } from '@tanstack/react-router'
import { Database, FileSearch } from 'lucide-react'
import { ExportWizard } from '@/components/export'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ExportSearch = {
  from?: 'datasource' | 'query'
  step?: number
  sourceEntity?: string
  destEnv?: string
  destEntity?: string
}

export const Route = createFileRoute('/export')({
  validateSearch: (search: Record<string, unknown>): ExportSearch => {
    return {
      from: search.from === 'datasource' || search.from === 'query' ? search.from : undefined,
      step: typeof search.step === 'number' ? search.step : undefined,
      sourceEntity: typeof search.sourceEntity === 'string' ? search.sourceEntity : undefined,
      destEnv: typeof search.destEnv === 'string' ? search.destEnv : undefined,
      destEntity: typeof search.destEntity === 'string' ? search.destEntity : undefined,
    }
  },
  component: ExportPage,
})

function ExportPage() {
  const { from } = Route.useSearch()

  // Show source selection screen if no `from` parameter
  if (!from) {
    return <ExportSourceSelection />
  }

  // Show query-based export placeholder (not yet implemented)
  if (from === 'query') {
    return <QueryExportPlaceholder />
  }

  // Show data source wizard
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Export from Data Source</h1>
        <p className="text-muted-foreground">
          Configure and queue a data migration between environments.
        </p>
      </div>

      <ExportWizard />
    </div>
  )
}

function ExportSourceSelection() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Choose how you want to export data from your source IMIS environment.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/export" search={{ from: 'datasource' }}>
          <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Database className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">From Data Source</CardTitle>
                  <CardDescription>Export data from a specific entity type</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Select a data source (BoEntityDefinition) from your source environment and map its
                properties to a destination data source.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full opacity-60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileSearch className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">From Query</CardTitle>
                <CardDescription>Export data using an IQA query</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Run a custom IQA query and export the results. This option is coming soon.
            </p>
            <div className="mt-3 inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Coming Soon
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QueryExportPlaceholder() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Export from Query</h1>
        <p className="text-muted-foreground">
          This feature is not yet implemented.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-8">
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <FileSearch className="size-12 mb-4" />
          <p className="text-lg font-medium">Query Export Coming Soon</p>
          <p className="text-sm mt-1 max-w-md text-center">
            The ability to export data using IQA queries will be available in a future update.
          </p>
          <Link to="/export" className="mt-4">
            <Button variant="outline">Go Back</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

