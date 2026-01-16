import { useState, useEffect } from "react";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useEnvironmentStore } from "@/stores/environment-store";
import { queries } from "@/lib/queries";
import { EnvironmentSelectScreen } from "@/components/environment-select-screen";
import { RunningJobIndicator } from "@/components/running-job-indicator";
import { MasterPasswordDialog } from "@/components/master-password-dialog";
import "../index.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const selectedId = useEnvironmentStore((s) => s.selectedId);
  const { data: environments } = useQuery(queries.environments.all());
  const { data: settings } = useQuery(queries.settings.current());

  // Track if we should show unlock dialog on startup
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [hasCheckedUnlock, setHasCheckedUnlock] = useState(false);

  // Check if we need to show unlock dialog on initial load
  useEffect(() => {
    if (settings && !hasCheckedUnlock) {
      setHasCheckedUnlock(true);
      // Show unlock dialog if storage is enabled but not unlocked
      if (settings.storePasswords && settings.hasMasterPassword && !settings.isUnlocked) {
        setShowUnlockDialog(true);
      }
    }
  }, [settings, hasCheckedUnlock]);

  // Find current environment and check if it has a password
  const currentEnvironment = environments?.find((env) => env.id === selectedId);
  const isReady = selectedId !== null && currentEnvironment?.hasPassword === true;

  // Show environment select screen until user has selected and authenticated
  if (!isReady) {
    return (
      <NuqsAdapter>
        <EnvironmentSelectScreen />
        {/* Unlock dialog can appear over environment select screen */}
        <MasterPasswordDialog
          mode="unlock"
          open={showUnlockDialog}
          onOpenChange={setShowUnlockDialog}
          onSkip={() => setShowUnlockDialog(false)}
        />
      </NuqsAdapter>
    );
  }

  return (
    <NuqsAdapter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1" />
            <RunningJobIndicator />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NuqsAdapter>
  );
}
