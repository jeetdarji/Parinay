// Matching data layer: pre-fetch the opposite-gender dummy pool (query) and
// trigger the backend match run on demand (mutation) with Render cold-start
// retry handling.
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { api } from '../lib/axios'

function oppositeGender(gender) {
  if (gender === 'Male') return 'Female'
  if (gender === 'Female') return 'Male'
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function useMatches(clientId, client) {
  const [isWakingUp, setIsWakingUp] = useState(false)
  const opp = oppositeGender(client?.gender)

  // --- Dummy pool (opposite gender) ---
  const dummyPoolQuery = useQuery({
    queryKey: ['dummyPool', opp],
    enabled: !!clientId && !!opp,
    staleTime: 1000 * 60 * 10, // 10 minutes
    queryFn: async () => {
      // Paginate to be safe (120 per gender, Supabase caps at 1000).
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_dummy', true)
        .eq('gender', opp)
      if (error) throw error
      return data ?? []
    },
  })

  // --- Match mutation with cold-start retry ---
  const matchMutation = useMutation({
    mutationFn: async () => {
      const body = {
        client_profile: client,
        candidate_pool: dummyPoolQuery.data ?? [],
      }
      const url = `/match/${clientId}`

      // Attempt 1 — short timeout.
      try {
        const res = await api.post(url, body, { timeout: 12000 })
        return res.data
      } catch (err) {
        const isTimeout =
          err?.code === 'ECONNABORTED' ||
          (!err?.response && err?.message !== 'Network Error')
        // Non-timeout (real 4xx/5xx or CORS error) → fail fast.
        if (!isTimeout) throw err
      }

      // Cold start: tell the UI we're waking the service, wait, retry long.
      setIsWakingUp(true)
      await sleep(8000)
      setIsWakingUp(false)
      try {
        const res = await api.post(url, body, { timeout: 30000 })
        return res.data
      } catch {
        throw new Error('SERVICE_UNAVAILABLE')
      }
    },
  })

  return {
    triggerMatch: matchMutation.mutate,
    matchData: matchMutation.data,
    isMatching: matchMutation.isPending,
    isWakingUp,
    matchError: matchMutation.error,
    resetMatch: matchMutation.reset,
    dummyPool: dummyPoolQuery.data ?? [],
    isDummyPoolLoading: dummyPoolQuery.isLoading,
  }
}
