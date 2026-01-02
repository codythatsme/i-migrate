import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ArrowRight, Loader2, Search, X, Trash2, Filter, Info, Lock } from 'lucide-react'
import { queries } from '@/lib/queries'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

// Properties that cannot be mapped to as they are auto-created on insert
const RESTRICTED_DESTINATION_PROPERTIES: Record<string, string> = {
  Ordinal: 'Auto-incrementing row ID for multi-instance data sources',
  UpdatedOn: 'Auto-set to the date/time the row is inserted',
  UpdatedBy: 'Auto-set to the username of the logged-in account',
  UpdatedByUserKey: 'Auto-set to the contact key of the logged-in account',
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
      // Skip restricted properties
      if (destProp.Name in RESTRICTED_DESTINATION_PROPERTIES) return false
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false)

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

  const handleClearAll = () => {
    const cleared = mappings.map(m => ({ ...m, destinationProperty: null }))
    onMappingsChange(cleared)
  }

  const mappedCount = useMemo(() => {
    return mappings.filter((m) => m.destinationProperty !== null).length
  }, [mappings])

  const filteredProperties = useMemo(() => {
    return queryProperties.filter((prop) => {
      const name = prop.Alias || prop.PropertyName
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (showUnmappedOnly) {
        const mapping = mappings.find(m => m.sourceProperty === name)
        return matchesSearch && (!mapping || mapping.destinationProperty === null)
      }
      
      return matchesSearch
    })
  }, [queryProperties, searchQuery, showUnmappedOnly, mappings])

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
          <h2 className="text-lg font-semibold text-foreground">Map Query Properties</h2>
          <p className="text-sm text-muted-foreground">Loading property definitions...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    )
  }

  if (!destEntity) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Map Query Properties</h2>
          <p className="text-sm text-destructive">
            Could not load destination entity definition. Please go back and verify your selection.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Map Query Properties</h2>
        <p className="text-sm text-muted-foreground">
          Map query output properties to destination data source properties. Properties with matching
          names and compatible types are auto-mapped.
        </p>
      </div>

      {/* Summary & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="size-4" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium truncate max-w-[300px]">
                {queryDefinition.Document.Name}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Query Results</span>
                <ArrowRight className="size-3" />
                <span>{destinationEntityType}</span>
              </div>
            </div>
          </div>
          
          <div className="ml-auto flex items-center gap-6">
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold">
                {mappedCount} / {queryProperties.length}
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
          <span>Query Property</span>
          <span className="text-center">Status</span>
          <span>Destination Property</span>
        </div>

        <div className="flex flex-col max-h-[500px] overflow-y-auto divide-y divide-border">
          {filteredProperties.length > 0 ? (
            filteredProperties.map((queryProp) => {
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
    <div className={`grid grid-cols-[1.2fr_48px_1fr] gap-4 items-center px-4 py-3 transition-colors ${
      isMapped ? 'bg-primary/[0.02] hover:bg-primary/[0.05]' : 'bg-background hover:bg-muted/50'
    }`}>
      {/* Source property */}
      <div className="flex flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isMapped ? 'text-foreground' : 'text-muted-foreground'}`}>
            {displayName}
          </span>
          {queryProperty.Caption && queryProperty.Caption !== displayName && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3.5 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Caption: {queryProperty.Caption}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
          {sourceType}
        </span>
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
          onValueChange={(value) => {
            // Prevent selecting restricted properties
            if (value !== '__unmapped__' && value in RESTRICTED_DESTINATION_PROPERTIES) return
            onDestinationChange(value === '__unmapped__' ? null : value)
          }}
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
              const destType = getBoPropertyTypeName(destProp)
              const isCompatibleType = destType === boCompatibleType
              const restrictedReason = RESTRICTED_DESTINATION_PROPERTIES[destProp.Name]
              const isRestricted = !!restrictedReason

              return (
                <TooltipProvider key={destProp.Name}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <SelectItem
                          value={destProp.Name}
                          className={isRestricted ? 'opacity-50 cursor-not-allowed pointer-events-none' : !isCompatibleType ? 'opacity-50' : ''}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{destProp.Name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted">
                              {destType}
                            </span>
                            {isRestricted ? (
                              <Lock className="size-3 text-muted-foreground" />
                            ) : !isCompatibleType && (
                              <AlertTriangle className="size-3 text-destructive" />
                            )}
                          </div>
                        </SelectItem>
                      </div>
                    </TooltipTrigger>
                    {(isRestricted || !isCompatibleType) && (
                      <TooltipContent>
                        <p className="text-xs">
                          {isRestricted ? restrictedReason : `Type mismatch: ${sourceType} → ${destType}`}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}


