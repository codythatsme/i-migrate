import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/tanstack-router'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useEnvironmentStore } from '@/stores/environment-store'
import { queries } from '@/lib/queries'
import { AddEnvironmentDialog } from '@/components/add-environment-dialog'
import { PasswordRequiredDialog } from '@/components/password-required-dialog'
import '../index.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <NuqsAdapter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
        <FirstRunDialog />
        <PasswordRequiredDialog />
      </SidebarProvider>
    </NuqsAdapter>
  )
}

function FirstRunDialog() {
  const { selectedId, selectEnvironment } = useEnvironmentStore()
  const { data: environments } = useQuery(queries.environments.all())

  // Auto-select first environment if none selected
  useEffect(() => {
    if (environments && environments.length > 0 && !selectedId) {
      const selectedExists = environments.some((e) => e.id === selectedId)
      if (!selectedExists) {
        const firstId = environments[0]?.id
        if (firstId) selectEnvironment(firstId)
      }
    }
  }, [environments, selectedId, selectEnvironment])

  // Show dialog only when environments have loaded and none exist
  const isFirstRun = environments !== undefined && environments.length === 0

  return (
    <AddEnvironmentDialog
      open={isFirstRun}
      onOpenChange={() => {}}
      isFirstRun
      onSuccess={selectEnvironment}
    />
  )
}
