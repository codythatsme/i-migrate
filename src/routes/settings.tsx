import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, KeyRound, AlertTriangle } from "lucide-react";
import { queries } from "@/lib/queries";
import { useDisablePasswordStorage, useChangeMasterPassword } from "@/lib/mutations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { MasterPasswordDialog } from "@/components/master-password-dialog";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: settings, isLoading } = useQuery(queries.settings.current());
  const disableStorage = useDisablePasswordStorage();
  const changeMasterPassword = useChangeMasterPassword();

  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);

  const storePasswords = settings?.storePasswords ?? false;

  const handleToggle = (checked: boolean) => {
    if (checked) {
      // Show enable dialog to set master password
      setShowEnableDialog(true);
    } else {
      // Show confirmation dialog before disabling
      setShowDisableConfirm(true);
    }
  };

  const handleDisable = () => {
    disableStorage.mutate(undefined, {
      onSuccess: () => {
        setShowDisableConfirm(false);
      },
    });
  };

  const handleChangePassword = () => {
    setChangeError(null);

    if (newPassword !== confirmNewPassword) {
      setChangeError("New passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      setChangeError("Password must be at least 4 characters");
      return;
    }

    changeMasterPassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setShowChangePassword(false);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmNewPassword("");
          setChangeError(null);
        },
        onError: (err: unknown) => {
          const error = err as { message?: string; _tag?: string };
          setChangeError(
            error.message || (error._tag ? `Error: ${error._tag}` : "Failed to change password"),
          );
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure application preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {storePasswords ? (
              <ShieldCheck className="size-5 text-green-600" />
            ) : (
              <ShieldOff className="size-5 text-muted-foreground" />
            )}
            Password Storage
          </CardTitle>
          <CardDescription>Control how environment passwords are handled.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor="store-passwords" className="flex flex-col items-start gap-1 pt-0.5">
              <span className="leading-none">Store passwords locally</span>
              <span className="text-xs font-normal text-muted-foreground">
                Passwords are encrypted with AES-256-GCM before storage
              </span>
            </Label>
            <Switch
              id="store-passwords"
              checked={storePasswords}
              onCheckedChange={handleToggle}
              disabled={disableStorage.isPending}
            />
          </div>

          {storePasswords ? (
            <>
              <Alert>
                <ShieldCheck className="size-4" />
                <AlertDescription>
                  Passwords are encrypted and stored locally. They will persist across app restarts
                  but require your master password to unlock.
                  {settings?.isUnlocked ? (
                    <span className="ml-1 font-medium text-green-600">(Unlocked)</span>
                  ) : (
                    <span className="ml-1 font-medium text-amber-600">(Locked)</span>
                  )}
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChangePassword(true)}
                  className="gap-2"
                >
                  <KeyRound className="size-4" />
                  Change Master Password
                </Button>
              </div>
            </>
          ) : (
            <Alert>
              <ShieldOff className="size-4" />
              <AlertDescription>
                Passwords are kept in memory only. You'll need to re-enter them each time the app
                restarts.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Enable storage dialog */}
      <MasterPasswordDialog mode="set" open={showEnableDialog} onOpenChange={setShowEnableDialog} />

      {/* Disable confirmation dialog */}
      <Dialog open={showDisableConfirm} onOpenChange={setShowDisableConfirm}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Disable Password Storage?</DialogTitle>
            <DialogDescription className="text-center">
              This will permanently delete all stored environment passwords. You'll need to re-enter
              them manually. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisableConfirm(false)}
              disabled={disableStorage.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableStorage.isPending}
            >
              {disableStorage.isPending ? "Disabling..." : "Disable Storage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change master password dialog */}
      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/20">
              <KeyRound className="h-6 w-6 text-chart-5" />
            </div>
            <DialogTitle className="text-center">Change Master Password</DialogTitle>
            <DialogDescription className="text-center">
              All stored passwords will be re-encrypted with the new master password.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setChangeError(null);
                }}
                autoComplete="current-password"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setChangeError(null);
                }}
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  setChangeError(null);
                }}
                autoComplete="new-password"
              />
            </div>

            {changeError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{changeError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmNewPassword("");
                setChangeError(null);
              }}
              disabled={changeMasterPassword.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={
                !currentPassword ||
                !newPassword ||
                !confirmNewPassword ||
                changeMasterPassword.isPending
              }
            >
              {changeMasterPassword.isPending ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
