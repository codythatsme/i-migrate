import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/mappings')({
  component: MappingsPage,
})

function MappingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Mappings</h1>
        <p className="text-zinc-400">
          Create and manage column mappings between source and destination data sources.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-zinc-500">Mapping builder coming soon...</p>
      </div>
    </div>
  )
}

