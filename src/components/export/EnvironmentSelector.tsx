import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Server, AlertCircle, CheckCircle2 } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type EnvironmentSelectorProps = {
  selectedId: string | null
  onSelect: (id: string) => void
  excludeId?: string | null
  title?: string
  description?: string
}

export function EnvironmentSelector({
  selectedId,
  onSelect,
  excludeId,
  title = 'Select Environment',
  description = 'Choose the destination environment',
}: EnvironmentSelectorProps) {
  const { data: environments, isLoading, error } = useQuery(queries.environments.all())

  const filteredEnvironments = useMemo(() => {
    if (!environments) return []
    return excludeId
      ? environments.filter((env) => env.id !== excludeId)
      : environments
  }, [environments, excludeId])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="size-8 mb-3" />
        <p className="font-medium">Failed to load environments</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  if (filteredEnvironments.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Server className="size-8 mb-3" />
          <p>No other environments available</p>
          <p className="text-sm mt-1">Add another environment to use as a destination.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredEnvironments.map((env) => {
          const isSelected = selectedId === env.id

          return (
            <Card
              key={env.id}
              className={`cursor-pointer transition-all hover:border-primary/50 ${
                isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''
              }`}
              onClick={() => onSelect(env.id)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Server className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <CardTitle className="text-sm truncate">{env.name}</CardTitle>
                    <CardDescription className="text-xs truncate">{env.username}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground truncate font-mono">{env.baseUrl}</p>
                  <div className="flex items-center gap-1.5 text-xs">
                    {env.hasPassword ? (
                      <span className="flex items-center gap-1 text-primary">
                        <CheckCircle2 className="size-3" />
                        Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <AlertCircle className="size-3" />
                        Password required
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

