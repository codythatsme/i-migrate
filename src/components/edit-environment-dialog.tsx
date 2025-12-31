import { useState, useEffect, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queries } from '@/lib/queries'
import { useUpdateEnvironment, useSetPassword } from '@/lib/mutations'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Environment } from '@/lib/environments'

type EditEnvironmentDialogProps = {
  environment: Environment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditEnvironmentDialog({
  environment,
  open,
  onOpenChange,
}: EditEnvironmentDialogProps) {
  const updateEnvironment = useUpdateEnvironment()
  const setPassword = useSetPassword()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPasswordValue] = useState('')

  // Query password status (server-side storage - we can't retrieve the actual password)
  const { data: passwordStatus } = useQuery({
    ...queries.environments.passwordStatus(environment?.id ?? ''),
    enabled: !!environment?.id && open,
  })

  // Reset form when environment changes
  useEffect(() => {
    if (environment) {
      setName(environment.name)
      setBaseUrl(environment.baseUrl)
      setUsername(environment.username)
      // Don't pre-fill password - it's stored server-side and not retrievable
      setPasswordValue('')
    }
  }, [environment])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!environment) return

    updateEnvironment.mutate(
      {
        id: environment.id,
        updates: {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          username: username.trim(),
        },
      },
      {
        onSuccess: () => {
          // Update password if provided, and wait for it to complete
          if (password) {
            setPassword.mutate(
              { environmentId: environment.id, password },
              {
                onSuccess: () => onOpenChange(false),
                onError: () => onOpenChange(false), // Still close on error
              }
            )
          } else {
            onOpenChange(false)
          }
        },
      }
    )
  }

  const isValid = name.trim() !== '' && baseUrl.trim() !== '' && username.trim() !== ''
  const isPending = updateEnvironment.isPending || setPassword.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Environment</DialogTitle>
          <DialogDescription>
            Update the environment details. Leave the password blank to keep the existing one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-env-name">Name</Label>
            <Input
              id="edit-env-name"
              placeholder="e.g., Production IMIS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-env-baseUrl">Base URL</Label>
            <Input
              id="edit-env-baseUrl"
              type="url"
              placeholder="e.g., https://api.imis.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-env-username">Username</Label>
            <Input
              id="edit-env-username"
              placeholder="Your IMIS username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-env-password">Password</Label>
            <Input
              id="edit-env-password"
              type="password"
              placeholder={passwordStatus?.hasPassword ? "Enter to update password" : "Enter password"}
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {passwordStatus?.hasPassword
                ? "Password is stored server-side. Leave blank to keep the current password."
                : "No password stored. Enter a password to save it server-side."}
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
