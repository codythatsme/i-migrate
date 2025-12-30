import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { MoreHorizontal, Pencil, Plus, Server, Trash2 } from 'lucide-react'
import { useEnvironmentStore } from '@/stores/environment-store'
import { queries } from '@/lib/queries'
import { useDeleteEnvironment } from '@/lib/mutations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddEnvironmentDialog } from '@/components/add-environment-dialog'
import { EditEnvironmentDialog } from '@/components/edit-environment-dialog'
import type { Environment } from '@/lib/environments'

export const Route = createFileRoute('/environments')({
  component: EnvironmentsPage,
})

function EnvironmentsPage() {
  const { selectedId, selectEnvironment, clearSelection } = useEnvironmentStore()
  const { data: environments } = useQuery(queries.environments.all())
  const deleteEnvironment = useDeleteEnvironment()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingEnvironment, setEditingEnvironment] = useState<Environment | null>(null)

  const selectedEnvironment = environments?.find((e) => e.id === selectedId) ?? null

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
                    ? 'border-emerald-600 ring-1 ring-emerald-600'
                    : 'hover:border-muted-foreground/25 transition-colors'
                }
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
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
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Base URL</span>
                      <span className="truncate max-w-[180px] font-mono text-xs">
                        {env.baseUrl}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-emerald-600/10 px-2 py-1 text-xs text-emerald-600">
                        <div className="size-1.5 rounded-full bg-emerald-600" />
                        Current Source
                      </div>
                    )}
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
