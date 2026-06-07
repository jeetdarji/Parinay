// TanStack Query v5 hook: the authenticated matchmaker's assigned clients.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export function useClients() {
  const userId = useAuthStore((s) => s.session?.user?.id)

  return useQuery({
    queryKey: ['clients', userId],
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('matchmaker_id', userId)
        .eq('is_dummy', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
