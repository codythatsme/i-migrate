import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { queries } from '@/lib/queries'
import {
  useCreateEnvironment,
  useUpdateEnvironment,
  useDeleteEnvironment,
  useSetPassword,
  useClearPassword,
} from '@/lib/mutations'
import type { Environment } from '@/lib/environments'

// Local storage key for persisting selected environment across page reloads
const SELECTED_ENV_KEY = 'i-migrate:selected-environment-id'

type EnvironmentContextValue = {
  // State
  environments: Environment[] | null // null = loading, [] = loaded with none
  selectedEnvironment: Environment | null
  selectedEnvironmentHasPassword: boolean // Whether the selected environment has a password stored server-side
  isLoading: boolean
  error: Error | null

  // Actions
  addEnvironment: (
    data: Pick<Environment, 'name' | 'baseUrl' | 'username'>,
    password: string
  ) => void
  updateEnvironment: (
    id: string,
    updates: Partial<Pick<Environment, 'name' | 'baseUrl' | 'username'>>,
    password?: string
  ) => void
  deleteEnvironment: (id: string) => void
  selectEnvironment: (id: string) => void
  setPassword: (environmentId: string, password: string) => Promise<void>
  clearPassword: (environmentId: string) => Promise<void>
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null)

export function useEnvironment() {
  const context = useContext(EnvironmentContext)
  if (!context) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider')
  }
  return context
}

type EnvironmentProviderProps = {
  children: ReactNode
}

export function EnvironmentProvider({ children }: EnvironmentProviderProps) {
  // Fetch environments from API via TanStack Query
  const {
    data: environments,
    isLoading,
    error,
  } = useQuery(queries.environments.all())

  // Local state
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SELECTED_ENV_KEY)
    }
    return null
  })

  // Query password status for selected environment (server-side storage)
  const { data: passwordStatus } = useQuery({
    ...queries.environments.passwordStatus(selectedId ?? ''),
    enabled: !!selectedId,
  })

  // Mutations
  const createMutation = useCreateEnvironment()
  const updateMutation = useUpdateEnvironment()
  const deleteMutation = useDeleteEnvironment()
  const setPasswordMutation = useSetPassword()
  const clearPasswordMutation = useClearPassword()

  // Auto-select first environment if none selected or selected doesn't exist
  useEffect(() => {
    if (environments && environments.length > 0) {
      const selectedExists = environments.some((e) => e.id === selectedId)
      if (!selectedExists) {
        const firstId = environments[0]?.id
        setSelectedId(firstId ?? null)
        localStorage.setItem(SELECTED_ENV_KEY, firstId ?? '')
      }
    }
  }, [environments, selectedId])

  // Clear selection if all environments deleted
  useEffect(() => {
    if (environments && environments.length === 0 && selectedId) {
      setSelectedId(null)
      localStorage.removeItem(SELECTED_ENV_KEY)
    }
  }, [environments, selectedId])

  const selectedEnvironment =
    environments?.find((e) => e.id === selectedId) ?? null

  const addEnvironment = useCallback(
    (
      data: Pick<Environment, 'name' | 'baseUrl' | 'username'>,
      password: string
    ) => {
      createMutation.mutate(data, {
        onSuccess: (newEnv) => {
          // Store password server-side
          setPasswordMutation.mutate({ environmentId: newEnv.id, password })

          // If this is the first environment, select it automatically
          if (!environments || environments.length === 0) {
            setSelectedId(newEnv.id)
            localStorage.setItem(SELECTED_ENV_KEY, newEnv.id)
          }
        },
      })
    },
    [createMutation, environments, setPasswordMutation]
  )

  const updateEnvironment = useCallback(
    (
      id: string,
      updates: Partial<Pick<Environment, 'name' | 'baseUrl' | 'username'>>,
      password?: string
    ) => {
      updateMutation.mutate(
        { id, updates },
        {
          onSuccess: () => {
            // Update password server-side if provided
            if (password !== undefined) {
              setPasswordMutation.mutate({ environmentId: id, password })
            }
          },
        }
      )
    },
    [updateMutation, setPasswordMutation]
  )

  const deleteEnvironment = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          // Password is cleared server-side when environment is deleted

          // If we deleted the selected environment, let the useEffect handle reselection
          if (selectedId === id) {
            setSelectedId(null)
            localStorage.removeItem(SELECTED_ENV_KEY)
          }
        },
      })
    },
    [deleteMutation, selectedId]
  )

  const selectEnvironment = useCallback((id: string) => {
    setSelectedId(id)
    localStorage.setItem(SELECTED_ENV_KEY, id)
  }, [])

  const setPassword = useCallback(
    async (environmentId: string, password: string) => {
      await setPasswordMutation.mutateAsync({ environmentId, password })
    },
    [setPasswordMutation]
  )

  const clearPassword = useCallback(
    async (environmentId: string) => {
      await clearPasswordMutation.mutateAsync(environmentId)
    },
    [clearPasswordMutation]
  )

  const value: EnvironmentContextValue = {
    environments: environments ?? null,
    selectedEnvironment,
    selectedEnvironmentHasPassword: passwordStatus?.hasPassword ?? false,
    isLoading,
    error: error as Error | null,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    selectEnvironment,
    setPassword,
    clearPassword,
  }

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  )
}
