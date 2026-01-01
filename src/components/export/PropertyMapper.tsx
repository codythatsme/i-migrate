import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ArrowRight, Info, Loader2 } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Button } from '@/components/ui/button'
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
import type { BoProperty, BoEntityDefinition } from '@/api/client'

// ---------------------
// Types
// ---------------------

export type PropertyMapping = {
  sourceProperty: string
  destinationProperty: string | null
}

type MappingWarning = {
  type: 'maxLength' | 'typeMismatch'
  message: string
}

type PropertyMapperProps = {
  sourceEnvironmentId: string
  sourceEntityType: string
  destinationEnvironmentId: string
  destinationEntityType: string
  mappings: PropertyMapping[]
  onMappingsChange: (mappings: PropertyMapping[]) => void
}

// ---------------------
// Helpers
// ---------------------

function getPropertyTypeName(prop: BoProperty): string {
  return prop.PropertyTypeName
}

function getMaxLength(prop: BoProperty): number | null {
  if (prop.PropertyTypeName === 'String' && 'MaxLength' in prop) {
    return prop.MaxLength
  }
  return null
}

function checkCompatibility(
  source: BoProperty,
  dest: BoProperty
): { compatible: boolean; warnings: MappingWarning[] } {
  const warnings: MappingWarning[] = []

  // Check type compatibility
  const sourceType = getPropertyTypeName(source)
  const destType = getPropertyTypeName(dest)

  if (sourceType !== destType) {
    return {
      compatible: false,
      warnings: [{ type: 'typeMismatch', message: `Type mismatch: ${sourceType} → ${destType}` }],
    }
  }

  // For strings, check MaxLength
  if (sourceType === 'String') {
    const sourceMaxLength = getMaxLength(source)
    const destMaxLength = getMaxLength(dest)

    if (sourceMaxLength && destMaxLength && sourceMaxLength > destMaxLength) {
      warnings.push({
        type: 'maxLength',
        message: `Source max length (${sourceMaxLength}) exceeds destination (${destMaxLength}). Data may be truncated.`,
      })
    }
  }

  return { compatible: true, warnings }
}

function findAutoMappings(
  sourceProps: BoProperty[],
  destProps: BoProperty[]
): PropertyMapping[] {
  return sourceProps.map((sourceProp) => {
    // Find matching destination property by name and compatible type
    const matchingDest = destProps.find((destProp) => {
      if (destProp.Name !== sourceProp.Name) return false
      const { compatible } = checkCompatibility(sourceProp, destProp)
      return compatible
    })

    return {
      sourceProperty: sourceProp.Name,
      destinationProperty: matchingDest?.Name ?? null,
    }
  })
}

// ---------------------
// Components
// ---------------------

export function PropertyMapper({
  sourceEnvironmentId,
  sourceEntityType,
  destinationEnvironmentId,
  destinationEntityType,
  mappings,
  onMappingsChange,
}: PropertyMapperProps) {
  const [hasInitialized, setHasInitialized] = useState(false)

  const { data: sourceData, isLoading: sourceLoading } = useQuery(
    queries.dataSources.byEnvironment(sourceEnvironmentId)
  )

  const { data: destData, isLoading: destLoading } = useQuery(
    queries.dataSources.byEnvironment(destinationEnvironmentId)
  )

  const sourceEntity = useMemo(() => {
    return sourceData?.Items.$values.find((e) => e.EntityTypeName === sourceEntityType)
  }, [sourceData, sourceEntityType])

  const destEntity = useMemo(() => {
    return destData?.Items.$values.find((e) => e.EntityTypeName === destinationEntityType)
  }, [destData, destinationEntityType])

  const sourceProperties = useMemo(() => {
    return sourceEntity?.Properties.$values ?? []
  }, [sourceEntity])

  const destProperties = useMemo(() => {
    return destEntity?.Properties.$values ?? []
  }, [destEntity])

  // Auto-map on initial load
  useEffect(() => {
    if (!hasInitialized && sourceProperties.length > 0 && destProperties.length > 0) {
      const autoMappings = findAutoMappings(sourceProperties, destProperties)
      onMappingsChange(autoMappings)
      setHasInitialized(true)
    }
  }, [sourceProperties, destProperties, hasInitialized, onMappingsChange])

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
      const sourceProp = sourceProperties.find((p) => p.Name === mapping.sourceProperty)
      const destProp = destProperties.find((p) => p.Name === mapping.destinationProperty)
      if (!sourceProp || !destProp) return count
      const { warnings } = checkCompatibility(sourceProp, destProp)
      return count + warnings.length
    }, 0)
  }, [mappings, sourceProperties, destProperties])

  if (sourceLoading || destLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Map Properties</h2>
          <p className="text-sm text-muted-foreground">Loading property definitions...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!sourceEntity || !destEntity) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Map Properties</h2>
          <p className="text-sm text-destructive">
            Could not load entity definitions. Please go back and verify your selections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Map Properties</h2>
        <p className="text-sm text-muted-foreground">
          Map source properties to destination properties. Properties with matching names and types
          are auto-mapped.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 rounded-lg border bg-card/50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{sourceEntityType}</span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{destinationEntityType}</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {mappedCount} of {sourceProperties.length} mapped
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
          <span>Source Property</span>
          <span></span>
          <span>Destination Property</span>
        </div>

        {sourceProperties.map((sourceProp) => {
          const mapping = mappings.find((m) => m.sourceProperty === sourceProp.Name)
          const destProp = destProperties.find((p) => p.Name === mapping?.destinationProperty)
          const compatibility =
            destProp && sourceProp ? checkCompatibility(sourceProp, destProp) : null

          return (
            <MappingRow
              key={sourceProp.Name}
              sourceProperty={sourceProp}
              destinationProperties={destProperties}
              selectedDestination={mapping?.destinationProperty ?? null}
              onDestinationChange={(dest) => handleMappingChange(sourceProp.Name, dest)}
              compatibility={compatibility}
            />
          )
        })}
      </div>
    </div>
  )
}

// ---------------------
// MappingRow Component
// ---------------------

type MappingRowProps = {
  sourceProperty: BoProperty
  destinationProperties: BoProperty[]
  selectedDestination: string | null
  onDestinationChange: (destination: string | null) => void
  compatibility: { compatible: boolean; warnings: MappingWarning[] } | null
}

function MappingRow({
  sourceProperty,
  destinationProperties,
  selectedDestination,
  onDestinationChange,
  compatibility,
}: MappingRowProps) {
  const sourceType = getPropertyTypeName(sourceProperty)
  const sourceMaxLength = getMaxLength(sourceProperty)

  // Filter destination properties to show only compatible types at the top
  const sortedDestinations = useMemo(() => {
    return [...destinationProperties].sort((a, b) => {
      const aType = getPropertyTypeName(a)
      const bType = getPropertyTypeName(b)
      // Same type as source goes first
      if (aType === sourceType && bType !== sourceType) return -1
      if (bType === sourceType && aType !== sourceType) return 1
      // Then alphabetically
      return a.Name.localeCompare(b.Name)
    })
  }, [destinationProperties, sourceType])

  const isMapped = selectedDestination !== null

  return (
    <div className="grid grid-cols-[1fr,40px,1fr] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Source property */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className="text-sm font-medium truncate">{sourceProperty.Name}</span>
        <span className="text-xs text-muted-foreground">
          {sourceType}
          {sourceMaxLength !== null && ` (${sourceMaxLength})`}
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
            const destType = getPropertyTypeName(destProp)
            const destMaxLength = getMaxLength(destProp)
            const isCompatibleType = destType === sourceType

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
                    {destMaxLength !== null && ` (${destMaxLength})`}
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

