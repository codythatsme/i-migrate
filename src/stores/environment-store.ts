import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'i-migrate:environment-store'

type EnvironmentStore = {
  selectedId: string | null
  selectEnvironment: (id: string) => void
  clearSelection: () => void
}

export const useEnvironmentStore = create<EnvironmentStore>()(
  persist(
    (set) => ({
      selectedId: null,
      selectEnvironment: (id) => set({ selectedId: id }),
      clearSelection: () => set({ selectedId: null }),
    }),
    {
      name: STORAGE_KEY,
    }
  )
)

