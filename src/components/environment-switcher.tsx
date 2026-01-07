import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Check, ChevronsUpDown, Plus, Server } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEnvironmentStore } from "@/stores/environment-store";
import { queries } from "@/lib/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { AddEnvironmentDialog } from "@/components/add-environment-dialog";

export function EnvironmentSwitcher() {
  const { state } = useSidebar();
  const { selectedId, selectEnvironment } = useEnvironmentStore();
  const { data: environments, isLoading } = useQuery(queries.environments.all());
  const [showAddDialog, setShowAddDialog] = useState(false);

  const selectedEnvironment = environments?.find((e) => e.id === selectedId) ?? null;

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary/10">
              <Server className="size-4 text-sidebar-primary" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="text-xs text-muted-foreground">Loading...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!selectedEnvironment) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => setShowAddDialog(true)}
            tooltip="Add Environment"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-dashed border-sidebar-border">
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="text-sm">Add Environment</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <AddEnvironmentDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          onSuccess={selectEnvironment}
        />
      </SidebarMenu>
    );
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                tooltip={selectedEnvironment.name}
              >
                {selectedEnvironment.icon ? (
                  <img
                    src={selectedEnvironment.icon}
                    alt=""
                    className="aspect-square size-8 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Server className="size-4" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-0.5 leading-none">
                  <span className="font-medium truncate">{selectedEnvironment.name}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {selectedEnvironment.username}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
              side={state === "collapsed" ? "right" : "top"}
              align="start"
              sideOffset={4}
            >
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Source Environment
              </DropdownMenuLabel>
              {environments?.map((env) => (
                <DropdownMenuItem
                  key={env.id}
                  onClick={() => selectEnvironment(env.id)}
                  className="gap-2 p-2"
                >
                  {env.icon ? (
                    <img src={env.icon} alt="" className="size-6 rounded-sm object-contain" />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                      <Server className="size-3" />
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{env.name}</span>
                    <span className="text-xs text-muted-foreground">{env.username}</span>
                  </div>
                  {env.id === selectedEnvironment.id && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowAddDialog(true)} className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-sm border border-dashed">
                  <Plus className="size-3" />
                </div>
                <span className="text-muted-foreground">Add Environment</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Debugging
              </DropdownMenuLabel>
              <DropdownMenuItem asChild className="gap-2 p-2">
                <Link to="/traces">
                  <div className="flex size-6 items-center justify-center rounded-sm bg-muted">
                    <Activity className="size-3" />
                  </div>
                  <span>Traces</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      <AddEnvironmentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={selectEnvironment}
      />
    </>
  );
}
