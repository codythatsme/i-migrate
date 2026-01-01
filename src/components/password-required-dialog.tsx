import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSetPassword } from '@/lib/mutations'
import { queries } from '@/lib/queries'
import { useEnvironmentStore } from '@/stores/environment-store'
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
import { KeyRound, AlertTriangle } from 'lucide-react'

export function PasswordRequiredDialog() {
  const { selectedId } = useEnvironmentStore()
  const { data: environments } = useQuery(queries.environments.all())
  const setPassword = useSetPassword()
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Find the current environment
  const currentEnvironment = environments?.find((env) => env.id === selectedId)

  // Show dialog if we have a selected environment that's missing a password
  const needsPassword =
    selectedId !== null &&
    currentEnvironment !== undefined &&
    !currentEnvironment.hasPassword

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedId) return

    setPassword.mutate(
      { environmentId: selectedId, password },
      {
        onSuccess: () => {
          setPasswordValue('')
          setError(null)
        },
        onError: (err) => {
          setError(err.message || 'Failed to set password')
        },
      }
    )
  }

  const isValid = password.length > 0
  const isPending = setPassword.isPending

  return (
    <Dialog open={needsPassword}>
      <DialogContent
        className="sm:max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/20">
            <KeyRound className="h-6 w-6 text-chart-5" />
          </div>
          <DialogTitle className="text-center">Password Required</DialogTitle>
          <DialogDescription className="text-center">
            {currentEnvironment ? (
              <>
                Enter the password for <span className="font-medium text-foreground">{currentEnvironment.name}</span> to continue.
                Passwords are stored in server memory and must be re-entered after server restarts.
              </>
            ) : (
              'Enter your password to continue.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="required-password">Password</Label>
            <Input
              id="required-password"
              type="password"
              placeholder="Enter your IMIS password"
              value={password}
              onChange={(e) => {
                setPasswordValue(e.target.value)
                setError(null)
              }}
              autoFocus
              autoComplete="current-password"
            />
            {currentEnvironment && (
              <p className="text-xs text-muted-foreground">
                Username: <span className="font-medium">{currentEnvironment.username}</span>
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
              type="submit"
              disabled={!isValid || isPending}
              className="w-full"
            >
              {isPending ? 'Unlocking...' : 'Unlock Environment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

