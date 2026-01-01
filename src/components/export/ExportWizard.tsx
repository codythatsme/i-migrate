import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  parseAsString,
  parseAsInteger,
  useQueryStates,
} from 'nuqs'
import { ArrowLeft, ArrowRight, Check, Database, Server, Map, ListChecks } from 'lucide-react'
import { useEnvironmentStore } from '@/stores/environment-store'
import { queries } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { DataSourceSelector } from './DataSourceSelector'
import { EnvironmentSelector } from './EnvironmentSelector'
import { PropertyMapper, type PropertyMapping } from './PropertyMapper'

// ---------------------
// URL State Configuration
// ---------------------

const exportSearchParams = {
  step: parseAsInteger.withDefault(1),
  sourceEntity: parseAsString,
  destEnv: parseAsString,
  destEntity: parseAsString,
}

// ---------------------
// Wizard Steps
// ---------------------

const STEPS = [
  { id: 1, title: 'Source Data', icon: Database, description: 'Select source data source' },
  { id: 2, title: 'Destination', icon: Server, description: 'Choose destination environment' },
  { id: 3, title: 'Target Data', icon: Database, description: 'Select destination data source' },
  { id: 4, title: 'Mapping', icon: Map, description: 'Map properties' },
] as const

// ---------------------
// Main Component
// ---------------------

export function ExportWizard() {
  const { selectedId: sourceEnvironmentId } = useEnvironmentStore()

  const [queryState, setQueryState] = useQueryStates(exportSearchParams)
  const { step, sourceEntity, destEnv, destEntity } = queryState

  // Local state for property mappings (not persisted to URL due to complexity)
  const [mappings, setMappings] = useState<PropertyMapping[]>([])

  // Fetch source data sources to get the selected entity's structure info
  const { data: sourceDataSources } = useQuery({
    ...queries.dataSources.byEnvironment(sourceEnvironmentId),
    enabled: !!sourceEnvironmentId,
  })

  // Get the selected source entity definition
  const selectedSourceEntity = useMemo(() => {
    if (!sourceDataSources || !sourceEntity) return null
    return sourceDataSources.Items.$values.find(
      (e) => e.EntityTypeName === sourceEntity
    ) ?? null
  }, [sourceDataSources, sourceEntity])

  // Compatibility filter for destination selection
  const destinationCompatibilityFilter = useMemo(() => {
    if (!selectedSourceEntity) return undefined
    return {
      objectTypeName: selectedSourceEntity.ObjectTypeName,
      primaryParentEntityTypeName: selectedSourceEntity.PrimaryParentEntityTypeName,
    }
  }, [selectedSourceEntity])

  // ---------------------
  // Navigation Handlers
  // ---------------------

  const goToStep = useCallback(
    (newStep: number) => {
      setQueryState({ step: newStep })
    },
    [setQueryState]
  )

  const handleNext = useCallback(() => {
    if (step < 4) {
      goToStep(step + 1)
    }
  }, [step, goToStep])

  const handleBack = useCallback(() => {
    if (step > 1) {
      goToStep(step - 1)
    }
  }, [step, goToStep])

  // ---------------------
  // Selection Handlers
  // ---------------------

  const handleSourceSelect = useCallback(
    (entityType: string) => {
      // Clear destination entity when source changes (compatibility may differ)
      setQueryState({ sourceEntity: entityType, destEntity: null })
      setMappings([])
    },
    [setQueryState]
  )

  const handleDestEnvSelect = useCallback(
    (envId: string) => {
      // Clear destination entity when changing environment
      setQueryState({ destEnv: envId, destEntity: null })
      setMappings([])
    },
    [setQueryState]
  )

  const handleDestEntitySelect = useCallback(
    (entityType: string) => {
      setQueryState({ destEntity: entityType })
      setMappings([])
    },
    [setQueryState]
  )

  const handleQueueJob = useCallback(() => {
    // TODO: Implement job queuing logic
    console.log('Queue job:', {
      sourceEnvironmentId,
      sourceEntity,
      destEnv,
      destEntity,
      mappings,
    })
    alert('Job queuing not yet implemented. Check console for mapping data.')
  }, [sourceEnvironmentId, sourceEntity, destEnv, destEntity, mappings])

  // ---------------------
  // Validation
  // ---------------------

  const canProceedFromStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return !!sourceEntity
      case 2:
        return !!destEnv
      case 3:
        return !!destEntity
      case 4:
        return mappings.some((m) => m.destinationProperty !== null)
      default:
        return false
    }
  }

  // ---------------------
  // Render
  // ---------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, index) => {
          const Icon = s.icon
          const isActive = step === s.id
          const isCompleted = step > s.id

          return (
            <div key={s.id} className="flex items-center">
              {index > 0 && (
                <div
                  className={`h-px w-8 mx-2 ${
                    isCompleted ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              <button
                onClick={() => s.id < step && goToStep(s.id)}
                disabled={s.id > step}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isCompleted
                    ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                <div
                  className={`flex size-6 items-center justify-center rounded-full ${
                    isCompleted && !isActive ? 'bg-primary/20' : ''
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{s.title}</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-border bg-card/50 p-6">
        {step === 1 && (
          <DataSourceSelector
            environmentId={sourceEnvironmentId}
            selectedEntityType={sourceEntity}
            onSelect={handleSourceSelect}
            title="Select Source Data Source"
            description="Choose the data source you want to export from the source environment."
          />
        )}

        {step === 2 && (
          <EnvironmentSelector
            selectedId={destEnv}
            onSelect={handleDestEnvSelect}
            excludeId={sourceEnvironmentId}
            title="Select Destination Environment"
            description="Choose the environment where you want to migrate the data."
          />
        )}

        {step === 3 && destEnv && (
          <DataSourceSelector
            environmentId={destEnv}
            selectedEntityType={destEntity}
            onSelect={handleDestEntitySelect}
            title="Select Destination Data Source"
            description="Choose the data source to migrate data into on the destination environment."
            compatibilityFilter={destinationCompatibilityFilter}
          />
        )}

        {step === 4 && sourceEnvironmentId && sourceEntity && destEnv && destEntity && (
          <PropertyMapper
            sourceEnvironmentId={sourceEnvironmentId}
            sourceEntityType={sourceEntity}
            destinationEnvironmentId={destEnv}
            destinationEntityType={destEntity}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={step === 1}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {step < 4 ? (
            <Button onClick={handleNext} disabled={!canProceedFromStep(step)}>
              Next
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button onClick={handleQueueJob} disabled={!canProceedFromStep(step)}>
              <ListChecks className="mr-2 size-4" />
              Queue Migration
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

