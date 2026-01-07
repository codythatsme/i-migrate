import { useState, useMemo, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Server, Plus, KeyRound, AlertTriangle, ArrowRight, Search } from "lucide-react";
import { useEnvironmentStore } from "@/stores/environment-store";
import { useSetPassword } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AddEnvironmentDialog } from "@/components/add-environment-dialog";
import type { EnvironmentWithStatus } from "@/api/schemas";

export function EnvironmentSelectScreen() {
  const { selectEnvironment } = useEnvironmentStore();
  const { data: environments, isLoading } = useQuery(queries.environments.all());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [pendingEnv, setPendingEnv] = useState<EnvironmentWithStatus | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const setPasswordMutation = useSetPassword();

  const showSearch = environments && environments.length > 5;

  const filteredEnvironments = useMemo(() => {
    if (!environments) return [];
    if (!searchQuery.trim()) return environments;
    const query = searchQuery.toLowerCase();
    return environments.filter(
      (env) => env.name.toLowerCase().includes(query) || env.username.toLowerCase().includes(query),
    );
  }, [environments, searchQuery]);

  const handleSelectEnvironment = (env: EnvironmentWithStatus) => {
    if (env.hasPassword) {
      // Already has password in session, select directly
      selectEnvironment(env.id);
    } else {
      // Needs password, show inline password form
      setPendingEnv(env);
      setPassword("");
      setError(null);
    }
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pendingEnv) return;

    setError(null);
    setPasswordMutation.mutate(
      { environmentId: pendingEnv.id, password },
      {
        onSuccess: () => {
          selectEnvironment(pendingEnv.id);
          setPendingEnv(null);
          setPassword("");
        },
        onError: (err) => {
          setError(err.message || "Failed to authenticate");
        },
      },
    );
  };

  const handleCancelPassword = () => {
    setPendingEnv(null);
    setPassword("");
    setError(null);
  };

  const handleAddEnvironmentSuccess = (envId: string) => {
    selectEnvironment(envId);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading environments...</div>
      </div>
    );
  }

  const hasEnvironments = environments && environments.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">i-migrate</h1>
          <p className="mt-2 text-muted-foreground">
            {hasEnvironments
              ? "Select an environment to continue"
              : "Add your first environment to get started"}
          </p>
        </div>

        {/* Password Entry View */}
        {pendingEnv && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center gap-3">
                {pendingEnv.icon ? (
                  <img
                    src={pendingEnv.icon}
                    alt=""
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <KeyRound className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <div className="font-medium">{pendingEnv.name}</div>
                  <div className="text-sm text-muted-foreground">{pendingEnv.username}</div>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="env-password">Password</Label>
                  <Input
                    id="env-password"
                    type="password"
                    placeholder="Enter your IMIS password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    autoFocus
                    autoComplete="current-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    Passwords are stored in server memory only
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCancelPassword}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!password || setPasswordMutation.isPending}
                  >
                    {setPasswordMutation.isPending ? "Connecting..." : "Continue"}
                    {!setPasswordMutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Environment List View */}
        {!pendingEnv && (
          <div className="space-y-3">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search environments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {filteredEnvironments.map((env) => (
              <Card
                key={env.id}
                className="cursor-pointer transition-colors hover:bg-accent"
                onClick={() => handleSelectEnvironment(env)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  {env.icon ? (
                    <img src={env.icon} alt="" className="h-10 w-10 rounded-lg object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Server className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{env.name}</div>
                    <div className="text-sm text-muted-foreground">{env.username}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}

            <Card
              className="cursor-pointer border-dashed transition-colors hover:bg-accent"
              onClick={() => setShowAddDialog(true)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-muted-foreground">Add Environment</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <AddEnvironmentDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          isFirstRun={!hasEnvironments}
          onSuccess={handleAddEnvironmentSuccess}
        />
      </div>
    </div>
  );
}
