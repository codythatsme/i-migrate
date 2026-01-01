import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MoreHorizontal, Pencil, Plug, Plus, Server, Trash2, XCircle } from 'lucide-react'
import { useEnvironmentStore } from '@/stores/environment-store'
import { queries } from '@/lib/queries'
import { useDeleteEnvironment, useTestConnection } from '@/lib/mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AddEnvironmentDialog } from '@/components/add-environment-dialog'
import { EditEnvironmentDialog } from '@/components/edit-environment-dialog'
import type { Environment } from '@/lib/environments'

export const Route = createFileRoute('/environments')({
  component: EnvironmentsPage,
})

type TestStatus = {
  status: 'idle' | 'testing' | 'success' | 'error'
  message?: string
}

function EnvironmentsPage() {
  const { selectedId, selectEnvironment, clearSelection } = useEnvironmentStore()
  const { data: environments } = useQuery(queries.environments.all())
  const deleteEnvironment = useDeleteEnvironment()
  const testConnection = useTestConnection()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null)
  const [testStatuses, setTestStatuses] = useState<Record<string, TestStatus>>({})

  const selectedEnvironment = environments?.find((e) => e.id === selectedId) ?? null

  // Handle test connection
  const handleTestConnection = (envId: string) => {
    setTestStatuses((prev) => ({ ...prev, [envId]: { status: 'testing' } }))

    testConnection.mutate(envId, {
      onSuccess: () => {
        setTestStatuses((prev) => ({ ...prev, [envId]: { status: 'success', message: 'Connected' } }))
        // Clear status after 5 seconds
        setTimeout(() => {
          setTestStatuses((prev) => ({ ...prev, [envId]: { status: 'idle' } }))
        }, 5000)
      },
      onError: (error) => {
        setTestStatuses((prev) => ({
          ...prev,
          [envId]: { status: 'error', message: error.message || 'Connection failed' },
        }))
        // Clear status after 8 seconds (longer for errors so user can read)
        setTimeout(() => {
          setTestStatuses((prev) => ({ ...prev, [envId]: { status: 'idle' } }))
        }, 8000)
      },
    })
  }

  // Auto-select first environment if none selected or selected doesn't exist
  useEffect(() => {
    if (environments && environments.length > 0) {
      const selectedExists = environments.some((e) => e.id === selectedId)
      if (!selectedExists) {
        const firstId = environments[0]?.id
        if (firstId) selectEnvironment(firstId)
      }
    }
  }, [environments, selectedId, selectEnvironment])

  // Clear selection if all environments deleted
  useEffect(() => {
    if (environments && environments.length === 0 && selectedId) {
      clearSelection()
    }
  }, [environments, selectedId, clearSelection])

  const handleDelete = (id: string) => {
    deleteEnvironment.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) {
          clearSelection()
        }
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Environments</h1>
          <p className="text-muted-foreground">
            Manage your IMIS environments. The selected environment will be used as the source
            for browsing data. Additional environments can be used as destinations.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shrink-0">
          <Plus className="mr-2 size-4" />
          Add Environment
        </Button>
      </div>

      {!environments || environments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Server className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No environments</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Get started by adding your first IMIS environment.
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="mt-4">
              <Plus className="mr-2 size-4" />
              Add Environment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {environments?.map((env) => {
            const isSelected = selectedEnvironment?.id === env.id
            return (
              <Card
                key={env.id}
                className={
                  isSelected
                    ? 'border-primary ring-1 ring-primary'
                    : 'hover:border-muted-foreground/25 transition-colors'
                }
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Server className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-base">{env.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {env.username}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isSelected && (
                        <>
                          <DropdownMenuItem onClick={() => selectEnvironment(env.id)}>
                            Set as Source
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem onClick={() => setEditingEnvironment(env)}>
                        <Pencil className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(env.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base URL</span>
                      <span className="truncate max-w-[180px] font-mono text-xs">
                        {env.baseUrl}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                        <div className="size-1.5 rounded-full bg-primary" />
                        Current Source
                      </div>
                    )}

                    {/* Test Connection Button and Status */}
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleTestConnection(env.id)}
                          disabled={testStatuses[env.id]?.status === 'testing'}
                        >
                          {testStatuses[env.id]?.status === 'testing' ? (
                            <>
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <Plug className="mr-1.5 size-3" />
                              Test Connection
                            </>
                          )}
                        </Button>

                        {/* Success indicator - inline */}
                        {testStatuses[env.id]?.status === 'success' && (
                          <div className="flex items-center gap-1 text-xs text-primary">
                            <CheckCircle2 className="size-3.5" />
                            <span>{testStatuses[env.id]?.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Error message - full width on its own line */}
                      {testStatuses[env.id]?.status === 'error' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive cursor-help">
                                <XCircle className="size-3.5 mt-0.5 shrink-0" />
                                <span className="leading-relaxed">
                                  {testStatuses[env.id]?.message}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p>{testStatuses[env.id]?.message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AddEnvironmentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={selectEnvironment}
      />
      <EditEnvironmentDialog
        environment={editingEnvironment}
        open={editingEnvironment !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEnvironment(null)
        }}
      />
    </div>
  )
}
