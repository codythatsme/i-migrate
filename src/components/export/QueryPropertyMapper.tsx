import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ArrowRight, Loader2 } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { BoProperty, QueryDefinition, QueryPropertyData } from '@/api/client'
import type { PropertyMapping } from './PropertyMapper'

// ---------------------
// Types
// ---------------------

type MappingWarning = {
  type: 'typeMismatch'
  message: string
}

type QueryPropertyMapperProps = {
  queryDefinition: QueryDefinition
  destinationEnvironmentId: string
  destinationEntityType: string
  mappings: PropertyMapping[]
  onMappingsChange: (mappings: PropertyMapping[]) => void
}

// ---------------------
// Type Mapping Helpers
// ---------------------

// Map query data types to BO property types for compatibility checking
const queryTypeToBoType: Record<string, string> = {
  'String': 'String',
  'Boolean': 'Boolean',
  'DateTime': 'Date',
  'Decimal': 'Decimal',
  'Double': 'Decimal',
  'Int32': 'Integer',
  'Int64': 'Integer',
  'Byte': 'Integer',
  'SByte': 'Integer',
  'Guid': 'String',
  'Byte[]': 'Binary',
}

function getBoCompatibleType(queryType: string): string {
  return queryTypeToBoType[queryType] ?? 'String'
}

function getBoPropertyTypeName(prop: BoProperty): string {
  return prop.PropertyTypeName
}

function checkCompatibility(
  sourceType: string,
  dest: BoProperty
): { compatible: boolean; warnings: MappingWarning[] } {
  const warnings: MappingWarning[] = []
  const boCompatibleType = getBoCompatibleType(sourceType)
  const destType = getBoPropertyTypeName(dest)

  if (boCompatibleType !== destType) {
    return {
      compatible: false,
      warnings: [{ type: 'typeMismatch', message: `Type mismatch: ${sourceType} → ${destType}` }],
    }
  }

  return { compatible: true, warnings }
}

function findAutoMappings(
  queryProps: readonly QueryPropertyData[],
  destProps: readonly BoProperty[]
): PropertyMapping[] {
  return queryProps.map((queryProp) => {
    // Find matching destination property by name (using Alias or PropertyName) and compatible type
    const queryName = queryProp.Alias || queryProp.PropertyName
    const matchingDest = destProps.find((destProp) => {
      if (destProp.Name.toLowerCase() !== queryName.toLowerCase()) return false
      const { compatible } = checkCompatibility(queryProp.DataTypeName, destProp)
      return compatible
    })

    return {
      sourceProperty: queryName,
      destinationProperty: matchingDest?.Name ?? null,
    }
  })
}

// ---------------------
// Components
// ---------------------

export function QueryPropertyMapper({
  queryDefinition,
  destinationEnvironmentId,
  destinationEntityType,
  mappings,
  onMappingsChange,
}: QueryPropertyMapperProps) {
  const [hasInitialized, setHasInitialized] = useState(false)

  const { data: destData, isLoading: destLoading } = useQuery(
    queries.dataSources.byEnvironment(destinationEnvironmentId)
  )

  const destEntity = useMemo(() => {
    return destData?.Items.$values.find((e) => e.EntityTypeName === destinationEntityType)
  }, [destData, destinationEntityType])

  const queryProperties = useMemo(() => {
    return queryDefinition.Properties.$values ?? []
  }, [queryDefinition])

  const destProperties = useMemo(() => {
    return destEntity?.Properties.$values ?? []
  }, [destEntity])

  // Auto-map on initial load
  useEffect(() => {
    if (!hasInitialized && queryProperties.length > 0 && destProperties.length > 0) {
      const autoMappings = findAutoMappings(queryProperties, destProperties)
      onMappingsChange(autoMappings)
      setHasInitialized(true)
    }
  }, [queryProperties, destProperties, hasInitialized, onMappingsChange])

  const handleMappingChange = (sourceProperty: string, destinationProperty: string | null) => {
    const newMappings = mappings.map((m) =>
      m.sourceProperty === sourceProperty
        ? { ...m, destinationProperty }
        : m
    )
    onMappingsChange(newMappings)
  }

  const mappedCount = useMemo(() => {
    return mappings.filter((m) => m.destinationProperty !== null).length
  }, [mappings])

  const warningCount = useMemo(() => {
    return mappings.reduce((count, mapping) => {
      if (!mapping.destinationProperty) return count
      const queryProp = queryProperties.find((p) => (p.Alias || p.PropertyName) === mapping.sourceProperty)
      const destProp = destProperties.find((p) => p.Name === mapping.destinationProperty)
      if (!queryProp || !destProp) return count
      const { warnings } = checkCompatibility(queryProp.DataTypeName, destProp)
      return count + warnings.length
    }, 0)
  }, [mappings, queryProperties, destProperties])

  if (destLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Map Query Properties</h2>
          <p className="text-sm text-muted-foreground">Loading property definitions...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!destEntity) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Map Query Properties</h2>
          <p className="text-sm text-destructive">
            Could not load destination entity definition. Please go back and verify your selection.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Map Query Properties</h2>
        <p className="text-sm text-muted-foreground">
          Map query output properties to destination data source properties. Properties with matching
          names and compatible types are auto-mapped.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[200px]">
            {queryDefinition.Document.Name}
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{destinationEntityType}</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {mappedCount} of {queryProperties.length} mapped
          </span>
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="size-3.5" />
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Mapping rows */}
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
        {/* Header */}
        <div className="grid grid-cols-[1fr,40px,1fr] gap-2 items-center px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-0 bg-background z-10 border-b">
          <span>Query Property</span>
          <span></span>
          <span>Destination Property</span>
        </div>

        {queryProperties.map((queryProp) => {
          const propKey = queryProp.Alias || queryProp.PropertyName
          const mapping = mappings.find((m) => m.sourceProperty === propKey)
          const destProp = destProperties.find((p) => p.Name === mapping?.destinationProperty)
          const compatibility =
            destProp ? checkCompatibility(queryProp.DataTypeName, destProp) : null

          return (
            <QueryMappingRow
              key={propKey}
              queryProperty={queryProp}
              destinationProperties={destProperties}
              selectedDestination={mapping?.destinationProperty ?? null}
              onDestinationChange={(dest) => handleMappingChange(propKey, dest)}
              compatibility={compatibility}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------------------
// QueryMappingRow Component
// ---------------------

type QueryMappingRowProps = {
  queryProperty: QueryPropertyData
  destinationProperties: readonly BoProperty[]
  selectedDestination: string | null
  onDestinationChange: (destination: string | null) => void
  compatibility: { compatible: boolean; warnings: MappingWarning[] } | null
}

function QueryMappingRow({
  queryProperty,
  destinationProperties,
  selectedDestination,
  onDestinationChange,
  compatibility,
}: QueryMappingRowProps) {
  const sourceType = queryProperty.DataTypeName
  const boCompatibleType = getBoCompatibleType(sourceType)

  // Sort destination properties to show compatible types first
  const sortedDestinations = useMemo(() => {
    return [...destinationProperties].sort((a, b) => {
      const aType = getBoPropertyTypeName(a)
      const bType = getBoPropertyTypeName(b)
      // Same type as source goes first
      if (aType === boCompatibleType && bType !== boCompatibleType) return -1
      if (bType === boCompatibleType && aType !== boCompatibleType) return 1
      // Then alphabetically
      return a.Name.localeCompare(b.Name)
    })
  }, [destinationProperties, boCompatibleType])

  const isMapped = selectedDestination !== null
  const displayName = queryProperty.Alias || queryProperty.PropertyName

  return (
    <div className="grid grid-cols-[1fr,40px,1fr] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Source property */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className="text-sm font-medium truncate">{displayName}</span>
        <span className="text-xs text-muted-foreground">
          {sourceType}
          {queryProperty.Caption && queryProperty.Caption !== displayName && (
            <span className="ml-1 text-muted-foreground/70">({queryProperty.Caption})</span>
          )}
        </span>
      </div>

      {/* Arrow/status */}
      <div className="flex justify-center">
        {isMapped ? (
          compatibility?.warnings.length ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="size-4 text-amber-600" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {compatibility.warnings.map((w, i) => (
                    <p key={i} className="text-xs">{w.message}</p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Check className="size-4 text-primary" />
          )
        ) : (
          <ArrowRight className="size-4 text-muted-foreground/50" />
        )}
      </div>

      {/* Destination select */}
      <Select
        value={selectedDestination ?? '__unmapped__'}
        onValueChange={(value) =>
          onDestinationChange(value === '__unmapped__' ? null : value)
        }
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Select destination..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unmapped__">
            <span className="text-muted-foreground">— Not mapped —</span>
          </SelectItem>
          {sortedDestinations.map((destProp) => {
            const destType = getBoPropertyTypeName(destProp)
            const isCompatibleType = destType === boCompatibleType

            return (
              <SelectItem
                key={destProp.Name}
                value={destProp.Name}
                className={!isCompatibleType ? 'opacity-50' : ''}
              >
                <div className="flex items-center gap-2">
                  <span>{destProp.Name}</span>
                  <span className="text-xs text-muted-foreground">
                    {destType}
                  </span>
                  {!isCompatibleType && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="size-3 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Type mismatch: {sourceType} → {destType}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}

