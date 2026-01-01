import { createFileRoute, Link } from '@tanstack/react-router'
import { Database, FileSearch } from 'lucide-react'
import { ExportWizard } from '@/components/export'
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

  const title = from === 'query' ? 'Export from Query' : 'Export from Data Source'
  const description = from === 'query'
    ? 'Select an IQA query to export data and map to a destination.'
    : 'Configure and queue a data migration between environments.'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <ExportWizard initialMode={from} />
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

        <Link to="/export" search={{ from: 'query' }}>
          <Card className="h-full cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
                Browse and select an IQA query from the CMS, then map its output properties to a
                destination data source.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}


