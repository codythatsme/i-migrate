import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ArrowRight, Info, Loader2, Search, X, Trash2, Filter } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
  sourceProps: readonly BoProperty[],
  destProps: readonly BoProperty[]
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)

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

  const handleClearAll = () => {
    const cleared = mappings.map(m => ({ ...m, destinationProperty: null }))
    onMappingsChange(cleared)
  }

  const mappedCount = useMemo(() => {
    return mappings.filter((m) => m.destinationProperty !== null).length
  }, [mappings])

  const filteredProperties = useMemo(() => {
    return sourceProperties.filter((prop) => {
      const matchesSearch = prop.Name.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (showUnmappedOnly) {
        const mapping = mappings.find(m => m.sourceProperty === prop.Name)
        return matchesSearch && (!mapping || mapping.destinationProperty === null)
      }
      
      return matchesSearch
    })
  }, [sourceProperties, searchQuery, showUnmappedOnly, mappings])

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
          <h2 className="text-lg font-semibold text-foreground">Map Properties</h2>
          <p className="text-sm text-muted-foreground">Loading property definitions...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    )
  }

  if (!sourceEntity || !destEntity) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Map Properties</h2>
          <p className="text-sm text-destructive">
            Could not load entity definitions. Please go back and verify your selections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Map Properties</h2>
        <p className="text-sm text-muted-foreground">
          Map source properties to destination properties. Properties with matching names and types
          are auto-mapped.
        </p>
      </div>

      {/* Summary & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Info className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Mapping Data</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{sourceEntityType}</span>
                <ArrowRight className="size-3" />
                <span>{destinationEntityType}</span>
              </div>
            </div>
          </div>
          
          <div className="ml-auto flex items-center gap-6">
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold">
                {mappedCount} / {sourceProperties.length}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Mapped
              </span>
            </div>
            
            {warningCount > 0 && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="size-3.5" />
                  {warningCount}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-amber-600/70 font-medium">
                  Warnings
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button
              variant={showUnmappedOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowUnmappedOnly(!showUnmappedOnly)}
              className="h-9 gap-2 shrink-0"
            >
              <Filter className="size-3.5" />
              {showUnmappedOnly ? "Showing Unmapped" : "Show Unmapped"}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClearAll} className="h-9 gap-2 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Mapping list */}
      <div className="flex flex-col rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1.2fr_48px_1fr] gap-4 items-center px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 border-b">
          <span>Source Property</span>
          <span className="text-center">Status</span>
          <span>Destination Property</span>
        </div>

        <div className="flex flex-col max-h-[500px] overflow-y-auto divide-y divide-border">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((sourceProp) => {
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
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Search className="size-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No properties found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------
// MappingRow Component
// ---------------------

type MappingRowProps = {
  sourceProperty: BoProperty
  destinationProperties: readonly BoProperty[]
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
    <div className={`grid grid-cols-[1.2fr_48px_1fr] gap-4 items-center px-4 py-3 transition-colors ${
      isMapped ? 'bg-primary/[0.02] hover:bg-primary/[0.05]' : 'bg-background hover:bg-muted/50'
    }`}>
      {/* Source property */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <span className={`text-sm font-medium truncate ${isMapped ? 'text-foreground' : 'text-muted-foreground'}`}>
          {sourceProperty.Name}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
            {sourceType}
          </span>
          {sourceMaxLength !== null && (
            <span className="text-[10px] text-muted-foreground/50 bg-muted px-1 rounded">
              LEN: {sourceMaxLength}
            </span>
          )}
        </div>
      </div>

      {/* Arrow/status */}
      <div className="flex justify-center">
        {isMapped ? (
          compatibility?.warnings.length ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <AlertTriangle className="size-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {compatibility.warnings.map((w, i) => (
                    <p key={i} className="text-xs">{w.message}</p>
                  ))}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-3.5" />
            </div>
          )
        ) : (
          <ArrowRight className="size-4 text-muted-foreground/30" />
        )}
      </div>

      {/* Destination select */}
      <div className="min-w-0">
        <Select
          value={selectedDestination ?? '__unmapped__'}
          onValueChange={(value) =>
            onDestinationChange(value === '__unmapped__' ? null : value)
          }
        >
          <SelectTrigger className={`h-9 text-xs transition-all ${
            isMapped ? 'border-primary/30 bg-primary/[0.03]' : 'border-input'
          }`}>
            <SelectValue placeholder="Select destination..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unmapped__">
              <div className="flex items-center gap-2 text-muted-foreground italic">
                <Trash2 className="size-3.5" />
                <span>Not mapped</span>
              </div>
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
                    <span className="font-medium">{destProp.Name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted">
                        {destType}
                      </span>
                      {destMaxLength !== null && (
                        <span className="text-[10px] text-muted-foreground/50 bg-muted/50 px-1 rounded">
                          ({destMaxLength})
                        </span>
                      )}
                    </div>
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
    </div>
  )
}


