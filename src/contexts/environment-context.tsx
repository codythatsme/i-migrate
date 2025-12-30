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
} from '@/lib/mutations'
import type { Environment } from '@/lib/environments'

// Local storage key for persisting selected environment across page reloads
const SELECTED_ENV_KEY = 'i-migrate:selected-environment-id'

type EnvironmentContextValue = {
  // State
  environments: Environment[]
  selectedEnvironment: Environment | null
  passwords: Map<string, string> // In-memory only, keyed by environment ID
  isFirstRun: boolean // True when no environments exist
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
  setPassword: (environmentId: string, password: string) => void
  getPassword: (environmentId: string) => string | undefined
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
    data: environments = [],
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
  const [passwords, setPasswords] = useState<Map<string, string>>(new Map())

  // Mutations
  const createMutation = useCreateEnvironment()
  const updateMutation = useUpdateEnvironment()
  const deleteMutation = useDeleteEnvironment()

  // Auto-select first environment if none selected or selected doesn't exist
  useEffect(() => {
    if (!isLoading && environments.length > 0) {
      const selectedExists = environments.some((e) => e.id === selectedId)
      if (!selectedExists) {
        const firstId = environments[0]?.id
        setSelectedId(firstId ?? null)
        localStorage.setItem(SELECTED_ENV_KEY, firstId ?? '')
      }
    }
  }, [environments, selectedId, isLoading])

  // Clear selection if all environments deleted
  useEffect(() => {
    if (!isLoading && environments.length === 0 && selectedId) {
      setSelectedId(null)
      localStorage.removeItem(SELECTED_ENV_KEY)
    }
  }, [environments, selectedId, isLoading])

  const selectedEnvironment =
    environments.find((e) => e.id === selectedId) ?? null

  const isFirstRun = !isLoading && environments.length === 0

  const addEnvironment = useCallback(
    (
      data: Pick<Environment, 'name' | 'baseUrl' | 'username'>,
      password: string
    ) => {
      createMutation.mutate(data, {
        onSuccess: (newEnv) => {
          // Store password in memory
          setPasswords((prev) => new Map(prev).set(newEnv.id, password))

          // If this is the first environment, select it automatically
          if (environments.length === 0) {
            setSelectedId(newEnv.id)
            localStorage.setItem(SELECTED_ENV_KEY, newEnv.id)
          }
        },
      })
    },
    [createMutation, environments.length]
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
            // Update password if provided
            if (password !== undefined) {
              setPasswords((prev) => new Map(prev).set(id, password))
            }
          },
        }
      )
    },
    [updateMutation]
  )

  const deleteEnvironment = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          // Remove password from memory
          setPasswords((prev) => {
            const next = new Map(prev)
            next.delete(id)
            return next
          })

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

  const setPassword = useCallback((environmentId: string, password: string) => {
    setPasswords((prev) => new Map(prev).set(environmentId, password))
  }, [])

  const getPassword = useCallback(
    (environmentId: string) => {
      return passwords.get(environmentId)
    },
    [passwords]
  )

  const value: EnvironmentContextValue = {
    environments,
    selectedEnvironment,
    passwords,
    isFirstRun,
    isLoading,
    error: error as Error | null,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    selectEnvironment,
    setPassword,
    getPassword,
  }

  return (
    <EnvironmentContext.Provider value={value}>
      {children}
    </EnvironmentContext.Provider>
  )
}
