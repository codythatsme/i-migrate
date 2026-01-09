import { useState, useEffect, type FormEvent } from "react";
import { useSetPassword } from "@/lib/mutations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, AlertTriangle } from "lucide-react";
import type { Environment } from "@/lib/environments";

interface SetPasswordDialogProps {
  environment: Environment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetPasswordDialog({ environment, open, onOpenChange }: SetPasswordDialogProps) {
  const setPassword = useSetPassword();
  const [password, setPasswordValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes or environment changes
  useEffect(() => {
    if (!open) {
      setPasswordValue("");
      setError(null);
    }
  }, [open, environment?.id]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!environment) return;

    setPassword.mutate(
      { environmentId: environment.id, password },
      {
        onSuccess: () => {
          setPasswordValue("");
          setError(null);
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          // Effect RPC errors are objects with _tag and fields, extract message
          const error = err as { message?: string; _tag?: string };
          const message =
            error.message || (error._tag ? `Error: ${error._tag}` : "Failed to set password");
          setError(message);
        },
      },
    );
  };

  const isValid = password.length > 0;
  const isPending = setPassword.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/20">
            <KeyRound className="h-6 w-6 text-chart-5" />
          </div>
          <DialogTitle className="text-center">Set Password</DialogTitle>
          <DialogDescription className="text-center">
            {environment ? (
              <>
                Enter the password for{" "}
                <span className="font-medium text-foreground">{environment.name}</span>. Passwords
                are stored in server memory and must be re-entered after server restarts.
              </>
            ) : (
              "Enter your password to continue."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="set-password">Password</Label>
            <Input
              id="set-password"
              type="password"
              placeholder="Enter your IMIS password"
              value={password}
              onChange={(e) => {
                setPasswordValue(e.target.value);
                setError(null);
              }}
              autoFocus
              autoComplete="current-password"
            />
            {environment && (
              <p className="text-xs text-muted-foreground">
                Username: <span className="font-medium">{environment.username}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? "Saving..." : "Save Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
