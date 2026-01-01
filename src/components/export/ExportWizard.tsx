import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  parseAsString,
  parseAsInteger,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Server,
  Map,
  ListChecks,
  FileSearch,
} from 'lucide-react'
import { useEnvironmentStore } from '@/stores/environment-store'
import { queries } from '@/lib/queries'
import { Button } from '@/components/ui/button'
import { DataSourceSelector } from './DataSourceSelector'
import { DestinationPasswordDialog } from './DestinationPasswordDialog'
import { EnvironmentSelector } from './EnvironmentSelector'
import { PropertyMapper, type PropertyMapping } from './PropertyMapper'
import { QueryFileBrowser } from './QueryFileBrowser'
import { QueryPropertyMapper } from './QueryPropertyMapper'

// ---------------------
// Types
// ---------------------

type ExportMode = 'datasource' | 'query'

// ---------------------
// URL State Configuration
// ---------------------

const exportSearchParams = {
  mode: parseAsStringLiteral(['datasource', 'query'] as const).withDefault('datasource'),
  step: parseAsInteger.withDefault(1),
  sourceEntity: parseAsString,
  sourceQuery: parseAsString,
  sourceQueryName: parseAsString,
  destEnv: parseAsString,
  destEntity: parseAsString,
}

// ---------------------
// Wizard Steps
// ---------------------

const DATASOURCE_STEPS = [
  { id: 1, title: 'Source Data', icon: Database, description: 'Select source data source' },
  { id: 2, title: 'Destination', icon: Server, description: 'Choose destination environment' },
  { id: 3, title: 'Target Data', icon: Database, description: 'Select destination data source' },
  { id: 4, title: 'Mapping', icon: Map, description: 'Map properties' },
] as const

const QUERY_STEPS = [
  { id: 1, title: 'Source Query', icon: FileSearch, description: 'Select source query' },
  { id: 2, title: 'Destination', icon: Server, description: 'Choose destination environment' },
  { id: 3, title: 'Target Data', icon: Database, description: 'Select destination data source' },
  { id: 4, title: 'Mapping', icon: Map, description: 'Map properties' },
] as const

// ---------------------
// Props
// ---------------------

type ExportWizardProps = {
  initialMode?: ExportMode
}

// ---------------------
// Main Component
// ---------------------

export function ExportWizard({ initialMode }: ExportWizardProps = {}) {
  const { selectedId: sourceEnvironmentId } = useEnvironmentStore()

  const [queryState, setQueryState] = useQueryStates(exportSearchParams)
  const { step, sourceEntity, sourceQuery, sourceQueryName, destEnv, destEntity } = queryState
  
  // Use initialMode from props if provided, otherwise use URL state
  const mode = initialMode ?? queryState.mode

  // Local state for property mappings (not persisted to URL due to complexity)
  const [mappings, setMappings] = useState<PropertyMapping[]>([])

  // State for destination password dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)

  // Get the current steps based on mode
  const STEPS = mode === 'query' ? QUERY_STEPS : DATASOURCE_STEPS

  // Fetch environments to check destination password status
  const { data: environments } = useQuery(queries.environments.all())

  // Fetch source data sources to get the selected entity's structure info (for datasource mode)
  const { data: sourceDataSources } = useQuery({
    ...queries.dataSources.byEnvironment(sourceEnvironmentId),
    enabled: !!sourceEnvironmentId && mode === 'datasource',
  })

  // Fetch query definition (for query mode)
  const { data: queryDefinitionData } = useQuery({
    ...queries.queryDefinition.byPath(sourceEnvironmentId, sourceQuery),
    enabled: !!sourceEnvironmentId && !!sourceQuery && mode === 'query',
  })

  // Get the selected source entity definition (for datasource mode)
  const selectedSourceEntity = useMemo(() => {
    if (mode !== 'datasource' || !sourceDataSources || !sourceEntity) return null
    return sourceDataSources.Items.$values.find(
      (e) => e.EntityTypeName === sourceEntity
    ) ?? null
  }, [mode, sourceDataSources, sourceEntity])

  // Compatibility filter for destination selection (for datasource mode)
  const destinationCompatibilityFilter = useMemo(() => {
    if (mode !== 'datasource' || !selectedSourceEntity) return undefined
    return {
      objectTypeName: selectedSourceEntity.ObjectTypeName,
      primaryParentEntityTypeName: selectedSourceEntity.PrimaryParentEntityTypeName,
    }
  }, [mode, selectedSourceEntity])

  // Check if destination environment needs a password
  const destinationEnvironment = environments?.find((env) => env.id === destEnv)
  const destNeedsPassword = destEnv !== null && destinationEnvironment !== undefined && !destinationEnvironment.hasPassword

  // ---------------------
  // Navigation Handlers
  // ---------------------

  const goToStep = (newStep: number) => {
    setQueryState({ step: newStep })
  }

  const handleNext = () => {
    if (step < 4) {
      // If moving from step 2 (destination selection) and destination needs password, prompt for it
      if (step === 2 && destNeedsPassword) {
        setShowPasswordDialog(true)
        return
      }
      goToStep(step + 1)
    }
  }

  const handlePasswordSuccess = () => {
    // Password was set successfully, proceed to next step
    goToStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1)
    }
  }

  // ---------------------
  // Mode Handler
  // ---------------------

  const handleModeChange = (newMode: ExportMode) => {
    // Reset all selections when switching modes
    setQueryState({
      mode: newMode,
      step: 1,
      sourceEntity: null,
      sourceQuery: null,
      sourceQueryName: null,
      destEnv: null,
      destEntity: null,
    })
    setMappings([])
  }

  // ---------------------
  // Selection Handlers
  // ---------------------

  const handleSourceSelect = (entityType: string) => {
    // Clear destination entity when source changes (compatibility may differ)
    setQueryState({ sourceEntity: entityType, destEntity: null })
    setMappings([])
  }

  const handleQuerySelect = (path: string, name: string) => {
    setQueryState({ sourceQuery: path, sourceQueryName: name, destEntity: null })
    setMappings([])
  }

  const handleDestEnvSelect = (envId: string) => {
    // Clear destination entity when changing environment
    setQueryState({ destEnv: envId, destEntity: null })
    setMappings([])
  }

  const handleDestEntitySelect = (entityType: string) => {
    setQueryState({ destEntity: entityType })
    setMappings([])
  }

  const handleQueueJob = () => {
    // TODO: Implement job queuing logic
    console.log('Queue job:', {
      mode,
      sourceEnvironmentId,
      sourceEntity: mode === 'datasource' ? sourceEntity : undefined,
      sourceQuery: mode === 'query' ? sourceQuery : undefined,
      destEnv,
      destEntity,
      mappings,
    })
    alert('Job queuing not yet implemented. Check console for mapping data.')
  }

  // ---------------------
  // Validation
  // ---------------------

  const canProceedFromStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return mode === 'datasource' ? !!sourceEntity : !!sourceQuery
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
      {/* Destination Password Dialog */}
      <DestinationPasswordDialog
        environmentId={destEnv}
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        onSuccess={handlePasswordSuccess}
      />

      {/* Mode Toggle - only show when mode is not controlled by parent */}
      {!initialMode && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-2">Export from:</span>
          <div className="flex rounded-lg border border-border p-1 bg-muted/30">
            <button
              onClick={() => handleModeChange('datasource')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'datasource'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Database className="size-3.5" />
              Data Source
            </button>
            <button
              onClick={() => handleModeChange('query')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === 'query'
                  ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSearch className="size-3.5" />
            Query (IQA)
          </button>
        </div>
      </div>
      )}

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
        {/* Step 1: Source Selection */}
        {step === 1 && mode === 'datasource' && (
          <DataSourceSelector
            environmentId={sourceEnvironmentId}
            selectedEntityType={sourceEntity}
            onSelect={handleSourceSelect}
            title="Select Source Data Source"
            description="Choose the data source you want to export from the source environment."
          />
        )}

        {step === 1 && mode === 'query' && (
          <QueryFileBrowser
            environmentId={sourceEnvironmentId}
            selectedQueryPath={sourceQuery}
            onSelect={handleQuerySelect}
            title="Select Source Query"
            description="Browse the CMS to find a query (IQA) to export data from."
          />
        )}

        {/* Step 2: Destination Environment */}
        {step === 2 && (
          <EnvironmentSelector
            selectedId={destEnv}
            onSelect={handleDestEnvSelect}
            excludeId={sourceEnvironmentId}
            title="Select Destination Environment"
            description="Choose the environment where you want to migrate the data."
          />
        )}

        {/* Step 3: Destination Data Source */}
        {step === 3 && destEnv && (
          <DataSourceSelector
            environmentId={destEnv}
            selectedEntityType={destEntity}
            onSelect={handleDestEntitySelect}
            title="Select Destination Data Source"
            description="Choose the data source to migrate data into on the destination environment."
            compatibilityFilter={mode === 'datasource' ? destinationCompatibilityFilter : undefined}
          />
        )}

        {/* Step 4: Property Mapping */}
        {step === 4 && mode === 'datasource' && sourceEnvironmentId && sourceEntity && destEnv && destEntity && (
          <PropertyMapper
            sourceEnvironmentId={sourceEnvironmentId}
            sourceEntityType={sourceEntity}
            destinationEnvironmentId={destEnv}
            destinationEntityType={destEntity}
            mappings={mappings}
            onMappingsChange={setMappings}
          />
        )}

        {step === 4 && mode === 'query' && sourceEnvironmentId && sourceQuery && destEnv && destEntity && queryDefinitionData?.Result && (
          <QueryPropertyMapper
            queryDefinition={queryDefinitionData.Result}
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
