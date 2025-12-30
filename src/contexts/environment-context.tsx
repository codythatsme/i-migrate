import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import {
  type Environment,
  getEnvironments,
  saveEnvironments,
  getSelectedEnvironmentId,
  setSelectedEnvironmentId,
  createEnvironment,
  updateEnvironment as updateEnvironmentHelper,
} from '@/lib/environments'

type EnvironmentContextValue = {
  // State
  environments: Environment[]
  selectedEnvironment: Environment | null
  passwords: Map<string, string> // In-memory only, keyed by environment ID
  isFirstRun: boolean // True when no environments exist
  isLoading: boolean

  // Actions
  addEnvironment: (
    data: Pick<Environment, 'name' | 'baseUrl' | 'username'>,
    password: string
  ) => Environment
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
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [passwords, setPasswords] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  // Load from session storage on mount
  useEffect(() => {
    const storedEnvs = getEnvironments()
    const storedSelectedId = getSelectedEnvironmentId()

    setEnvironments(storedEnvs)

    // If we have a stored selection and it exists, use it
    // Otherwise, use the first environment if available
    if (storedSelectedId && storedEnvs.some((e) => e.id === storedSelectedId)) {
      setSelectedId(storedSelectedId)
    } else if (storedEnvs.length > 0) {
      setSelectedId(storedEnvs[0].id)
      setSelectedEnvironmentId(storedEnvs[0].id)
    }

    setIsLoading(false)
  }, [])

  const selectedEnvironment =
    environments.find((e) => e.id === selectedId) ?? null

  const isFirstRun = !isLoading && environments.length === 0

  const addEnvironment = useCallback(
    (
      data: Pick<Environment, 'name' | 'baseUrl' | 'username'>,
      password: string
    ) => {
      const newEnv = createEnvironment(data)

      setEnvironments((prev) => {
        const updated = [...prev, newEnv]
        saveEnvironments(updated)
        return updated
      })

      // Store password in memory
      setPasswords((prev) => new Map(prev).set(newEnv.id, password))

      // If this is the first environment, select it automatically
      if (environments.length === 0) {
        setSelectedId(newEnv.id)
        setSelectedEnvironmentId(newEnv.id)
      }

      return newEnv
    },
    [environments.length]
  )

  const updateEnvironment = useCallback(
    (
      id: string,
      updates: Partial<Pick<Environment, 'name' | 'baseUrl' | 'username'>>,
      password?: string
    ) => {
      setEnvironments((prev) => {
        const updated = prev.map((env) =>
          env.id === id ? updateEnvironmentHelper(env, updates) : env
        )
        saveEnvironments(updated)
        return updated
      })

      // Update password if provided
      if (password !== undefined) {
        setPasswords((prev) => new Map(prev).set(id, password))
      }
    },
    []
  )

  const deleteEnvironment = useCallback(
    (id: string) => {
      setEnvironments((prev) => {
        const updated = prev.filter((env) => env.id !== id)
        saveEnvironments(updated)

        // If we deleted the selected environment, select another one
        if (selectedId === id) {
          const newSelectedId = updated.length > 0 ? updated[0].id : null
          setSelectedId(newSelectedId)
          setSelectedEnvironmentId(newSelectedId)
        }

        return updated
      })

      // Remove password from memory
      setPasswords((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    },
    [selectedId]
  )

  const selectEnvironment = useCallback((id: string) => {
    setSelectedId(id)
    setSelectedEnvironmentId(id)
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

