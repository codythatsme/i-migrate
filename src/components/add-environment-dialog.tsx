import { useState, type FormEvent } from 'react'
import { useCreateEnvironment, useSetPassword } from '@/lib/mutations'
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

type AddEnvironmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isFirstRun?: boolean
  onSuccess?: (environmentId: string) => void
}

export function AddEnvironmentDialog({
  open,
  onOpenChange,
  isFirstRun = false,
  onSuccess,
}: AddEnvironmentDialogProps) {
  const createEnvironment = useCreateEnvironment()
  const setPassword = useSetPassword()
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPasswordValue] = useState('')

  const resetForm = () => {
    setName('')
    setBaseUrl('')
    setUsername('')
    setPasswordValue('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()

    createEnvironment.mutate(
      {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        username: username.trim(),
      },
      {
        onSuccess: (env) => {
          setPassword.mutate({ environmentId: env.id, password })
          resetForm()
          onOpenChange(false)
          onSuccess?.(env.id)
        },
      }
    )
  }

  const isValid =
    name.trim() !== '' &&
    baseUrl.trim() !== '' &&
    username.trim() !== '' &&
    password !== ''

  const isPending = createEnvironment.isPending || setPassword.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={isFirstRun ? undefined : onOpenChange}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={isFirstRun ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isFirstRun ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            {isFirstRun ? 'Add Your First Environment' : 'Add Environment'}
          </DialogTitle>
          <DialogDescription>
            {isFirstRun
              ? 'To get started, add an IMIS environment. This will be used as your source environment.'
              : 'Add a new IMIS environment. Passwords are stored securely in server memory.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-name">Name</Label>
            <Input
              id="env-name"
              placeholder="e.g., Production IMIS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-baseUrl">Base URL</Label>
            <Input
              id="env-baseUrl"
              type="url"
              placeholder="e.g., https://api.imis.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-username">Username</Label>
            <Input
              id="env-username"
              placeholder="Your IMIS username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="env-password">Password</Label>
            <Input
              id="env-password"
              type="password"
              placeholder="Your IMIS password"
              value={password}
              onChange={(e) => setPasswordValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Stored in server memory only. You&apos;ll need to re-enter if the server restarts.
            </p>
          </div>
          <DialogFooter className="pt-2">
            {!isFirstRun && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={!isValid || isPending}>
              {isPending ? 'Saving...' : 'Save Environment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
