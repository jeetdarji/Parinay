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

      // Attempt 1 — generous timeout (batch encoding is fast, but Render
      // cold-start can add 30-60s on top of the ~5-10s encoding).
      try {
        const res = await api.post(url, body, { timeout: 60000 })
        return res.data
      } catch (err) {
        // Real HTTP errors (4xx/5xx) → fail immediately, don't retry.
        if (err?.response) throw err
        // Non-timeout network errors (CORS, DNS) → also fail immediately.
        if (err?.message === 'Network Error') throw err
      }

      // If we got here, attempt 1 timed out. The server is likely
      // cold-starting. Show the "waking up" UI and give it more time.
      setIsWakingUp(true)
      await sleep(5000) // brief pause before retry
      try {
        const res = await api.post(url, body, { timeout: 120000 })
        return res.data
      } catch {
        throw new Error('SERVICE_UNAVAILABLE')
      } finally {
        setIsWakingUp(false)
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
