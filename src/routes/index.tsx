import { Link } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'
import { Database, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center gap-12 min-h-[60vh]">
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Welcome to i-migrate</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Safely migrate and tabulate data between IMIS environments with row-level logging and retries.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Button asChild size="lg" className="gap-3 px-8 py-6 text-base">
          <Link to="/export" search={{ from: 'datasource' }}>
            <Database className="size-5" />
            Export from data source
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="gap-3 px-8 py-6 text-base">
          <Link to="/export" search={{ from: 'query' }}>
            <FileText className="size-5" />
            Export from query
          </Link>
        </Button>
      </div>
    </div>
  )
}
