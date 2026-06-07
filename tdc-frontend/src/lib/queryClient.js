// Shared TanStack Query client. Conservative defaults — matchmaker data
// changes on the scale of minutes, not seconds.
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})
