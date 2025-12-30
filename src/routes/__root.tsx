import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppSidebar } from '@/components/app-sidebar'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { EnvironmentProvider, useEnvironment } from '@/contexts/environment-context'
import { AddEnvironmentDialog } from '@/components/add-environment-dialog'
import '../index.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <EnvironmentProvider>
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
      <FirstRunDialog />
    </EnvironmentProvider>
  )
}

// Separate component to access environment context
function FirstRunDialog() {
  const { environments } = useEnvironment()

  // Show dialog only when environments have loaded (not null) and none exist
  const isFirstRun = environments !== null && environments.length === 0

  return (
    <AddEnvironmentDialog
      open={isFirstRun}
      onOpenChange={() => {}}
      isFirstRun
    />
  )
}
