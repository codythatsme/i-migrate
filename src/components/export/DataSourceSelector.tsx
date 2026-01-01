import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, Search, Loader2, AlertCircle } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { BoEntityDefinition } from '@/api/client'

type DataSourceSelectorProps = {
  environmentId: string | null
  selectedEntityType: string | null
  onSelect: (entityType: string) => void
  title?: string
  description?: string
}

export function DataSourceSelector({
  environmentId,
  selectedEntityType,
  onSelect,
  title = 'Select Data Source',
  description = 'Choose a data source to export from',
}: DataSourceSelectorProps) {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    ...queries.dataSources.byEnvironment(environmentId),
    enabled: !!environmentId,
  })

  const dataSources = useMemo(() => {
    if (!data) return []
    return data.Items.$values
  }, [data])

  const filteredSources = useMemo(() => {
    if (!search.trim()) return dataSources
    const searchLower = search.toLowerCase()
    return dataSources.filter(
      (source) =>
        source.EntityTypeName.toLowerCase().includes(searchLower) ||
        source.Description.toLowerCase().includes(searchLower)
    )
  }, [dataSources, search])

  if (!environmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="size-8 mb-3" />
        <p>No environment selected</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search data sources..." className="pl-9" disabled />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="size-8 mb-3" />
        <p className="font-medium">Failed to load data sources</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search data sources..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredSources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Database className="size-8 mb-3" />
          <p>{search ? 'No matching data sources found' : 'No data sources available'}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredSources.map((source) => (
            <DataSourceCard
              key={source.EntityTypeName}
              source={source}
              isSelected={selectedEntityType === source.EntityTypeName}
              onSelect={() => onSelect(source.EntityTypeName)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filteredSources.length} of {dataSources.length} data sources
      </p>
    </div>
  )
}

type DataSourceCardProps = {
  source: BoEntityDefinition
  isSelected: boolean
  onSelect: () => void
}

function DataSourceCard({ source, isSelected, onSelect }: DataSourceCardProps) {
  const propertyCount = source.Properties.$values.length

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            <Database className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <CardTitle className="text-sm truncate">{source.EntityTypeName}</CardTitle>
            <CardDescription className="text-xs truncate">
              {source.Description || source.ObjectTypeName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{propertyCount} properties</span>
          {source.PrimaryParentEntityTypeName && (
            <>
              <span>•</span>
              <span className="truncate">Parent: {source.PrimaryParentEntityTypeName}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

