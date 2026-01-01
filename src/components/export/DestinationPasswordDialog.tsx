import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSetPassword } from '@/lib/mutations'
import { queries } from '@/lib/queries'
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
import { KeyRound, AlertTriangle, Server } from 'lucide-react'

type DestinationPasswordDialogProps = {
  environmentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DestinationPasswordDialog({
  environmentId,
  open,
  onOpenChange,
  onSuccess,
}: DestinationPasswordDialogProps) {
  const { data: environments } = useQuery(queries.environments.all())
  const setPassword = useSetPassword()
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Find the destination environment
  const destinationEnvironment = environments?.find((env) => env.id === environmentId)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!environmentId) return

    setPassword.mutate(
      { environmentId, password },
      {
        onSuccess: () => {
          setPasswordValue('')
          setError(null)
          onOpenChange(false)
          onSuccess()
        },
        onError: (err) => {
          setError(err.message || 'Failed to set password')
        },
      }
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPasswordValue('')
      setError(null)
    }
    onOpenChange(newOpen)
  }

  const isValid = password.length > 0
  const isPending = setPassword.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/20">
            <KeyRound className="h-6 w-6 text-chart-5" />
          </div>
          <DialogTitle className="text-center">Destination Password Required</DialogTitle>
          <DialogDescription className="text-center">
            {destinationEnvironment ? (
              <>
                Enter the password for{' '}
                <span className="font-medium text-foreground">{destinationEnvironment.name}</span>{' '}
                to continue with the migration.
              </>
            ) : (
              'Enter the destination environment password to continue.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {destinationEnvironment && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Server className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <span className="text-sm font-medium truncate">{destinationEnvironment.name}</span>
                <span className="text-xs text-muted-foreground truncate font-mono">
                  {destinationEnvironment.baseUrl}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="destination-password">Password</Label>
            <Input
              id="destination-password"
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
            {destinationEnvironment && (
              <p className="text-xs text-muted-foreground">
                Username: <span className="font-medium">{destinationEnvironment.username}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? 'Unlocking...' : 'Unlock & Continue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

