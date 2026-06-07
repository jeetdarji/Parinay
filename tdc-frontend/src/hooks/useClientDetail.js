// TanStack Query v5: bundles the four queries that power the client detail page.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useClientDetail(clientId) {
  const enabled = !!clientId

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single()
      if (error) throw error
      return data
    },
  })

  const notesQuery = useQuery({
    queryKey: ['notes', clientId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const stageHistoryQuery = useQuery({
    queryKey: ['stage_history', clientId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_history')
        .select('*')
        .eq('client_id', clientId)
        .order('changed_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const matchRecordsQuery = useQuery({
    queryKey: ['match_records', clientId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_records')
        .select(
          '*, matched_with:profiles!matched_with_id(first_name, last_name, city, designation)'
        )
        .eq('client_id', clientId)
        .order('sent_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  return {
    client: clientQuery.data,
    notes: notesQuery.data ?? [],
    stageHistory: stageHistoryQuery.data ?? [],
    matchRecords: matchRecordsQuery.data ?? [],
    isLoading:
      clientQuery.isLoading ||
      notesQuery.isLoading ||
      stageHistoryQuery.isLoading ||
      matchRecordsQuery.isLoading,
    isError:
      clientQuery.isError ||
      notesQuery.isError ||
      stageHistoryQuery.isError ||
      matchRecordsQuery.isError,
  }
}
