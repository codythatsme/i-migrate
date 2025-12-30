import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 30 seconds before data is considered stale
      staleTime: 30 * 1000,
      // Retry failed requests up to 3 times with exponential backoff
      retry: 3,
      // Refetch on window focus for fresh data
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    },
  },
})

