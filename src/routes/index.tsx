import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to i-migrate</h1>
        <p className="text-zinc-400 text-lg">
          Safely migrate and tabulate data between IMIS environments with row-level logging and retries.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <QuickStartCard
          title="1. Environments"
          description="Configure your source and destination IMIS environments"
          href="/environments"
        />
        <QuickStartCard
          title="2. Browse"
          description="Explore data sources and queries from your source environment"
          href="/browse"
        />
        <QuickStartCard
          title="3. Mappings"
          description="Create column mappings between source and destination"
          href="/mappings"
        />
        <QuickStartCard
          title="4. Jobs"
          description="Queue and run import jobs with live progress tracking"
          href="/jobs"
        />
      </div>
    </div>
  )
}

function QuickStartCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      className="group block p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all"
    >
      <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </a>
  )
}

