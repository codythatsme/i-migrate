import { useState, useEffect, type FormEvent } from "react";
import { useEnablePasswordStorage, useVerifyMasterPassword } from "@/lib/mutations";
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
import { ShieldCheck, AlertTriangle } from "lucide-react";

interface MasterPasswordDialogProps {
  mode: "set" | "unlock";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onSkip?: () => void;
}

export function MasterPasswordDialog({
  mode,
  open,
  onOpenChange,
  onSuccess,
  onSkip,
}: MasterPasswordDialogProps) {
  const enableStorage = useEnablePasswordStorage();
  const verifyPassword = useVerifyMasterPassword();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPassword("");
      setConfirmPassword("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "set") {
      // Validate password confirmation
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }

      enableStorage.mutate(password, {
        onSuccess: () => {
          setPassword("");
          setConfirmPassword("");
          setError(null);
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: unknown) => {
          const error = err as { message?: string; _tag?: string };
          const message =
            error.message || (error._tag ? `Error: ${error._tag}` : "Failed to enable storage");
          setError(message);
        },
      });
    } else {
      // Unlock mode
      verifyPassword.mutate(password, {
        onSuccess: () => {
          setPassword("");
          setError(null);
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err: unknown) => {
          const error = err as { message?: string; _tag?: string };
          const message =
            error.message || (error._tag ? `Error: ${error._tag}` : "Invalid master password");
          setError(message);
        },
      });
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    onSkip?.();
  };

  const isValid =
    mode === "set" ? password.length >= 4 && password === confirmPassword : password.length > 0;
  const isPending = enableStorage.isPending || verifyPassword.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/20">
            <ShieldCheck className="h-6 w-6 text-chart-5" />
          </div>
          <DialogTitle className="text-center">
            {mode === "set" ? "Set Master Password" : "Unlock Passwords"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === "set" ? (
              <>
                Create a master password to encrypt your stored environment passwords. This password
                is never stored and will be required on app restart.
              </>
            ) : (
              <>
                Enter your master password to unlock stored environment passwords. You can skip this
                to use the app without stored passwords.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="master-password">
              {mode === "set" ? "Master Password" : "Password"}
            </Label>
            <Input
              id="master-password"
              type="password"
              placeholder={mode === "set" ? "Create a master password" : "Enter master password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              autoFocus
              autoComplete={mode === "set" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "set" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="pt-2">
            {mode === "unlock" && onSkip && (
              <Button type="button" variant="ghost" onClick={handleSkip} disabled={isPending}>
                Skip
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending
                ? mode === "set"
                  ? "Enabling..."
                  : "Unlocking..."
                : mode === "set"
                  ? "Enable Storage"
                  : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
