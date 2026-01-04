import { useEffect, useRef } from 'react'
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
import { EnvironmentSelectScreen } from '@/components/environment-select-screen'
import '../index.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { selectedId, clearSelection } = useEnvironmentStore()
  const { data: environments } = useQuery(queries.environments.all())
  const hasCleared = useRef(false)

  // Clear environment selection on app startup so user must select each session
  useEffect(() => {
    if (!hasCleared.current) {
      hasCleared.current = true
      clearSelection()
    }
  }, [clearSelection])

  // Find current environment and check if it has a password
  const currentEnvironment = environments?.find((env) => env.id === selectedId)
  const isReady = selectedId !== null && currentEnvironment?.hasPassword === true

  // Show environment select screen until user has selected and authenticated
  if (!isReady) {
    return (
      <NuqsAdapter>
        <EnvironmentSelectScreen />
      </NuqsAdapter>
    )
  }

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
      </SidebarProvider>
    </NuqsAdapter>
  )
}
