import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/environments')({
  component: EnvironmentsPage,
})

function EnvironmentsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Environments</h1>
        <p className="text-zinc-400">
          Manage your IMIS environments. Passwords are entered per session and never stored.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-zinc-500">Environment management coming soon...</p>
      </div>
    </div>
  )
}

