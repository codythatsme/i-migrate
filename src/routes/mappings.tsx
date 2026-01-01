import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mappings')({
  component: MappingsPage,
})

function MappingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Mappings</h1>
        <p className="text-muted-foreground">
          Create and manage column mappings between source and destination data sources.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
        <p className="text-muted-foreground">Mapping builder coming soon...</p>
      </div>
    </div>
  )
}

