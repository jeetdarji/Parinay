// Zustand auth store. Holds the Supabase session + the matchmaker profile row.
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set, get) => ({
  session: null,
  matchmaker: null, // row from public.matchmakers
  initializing: true,

  // Derived helper: first name for greetings.
  firstName: () => {
    const m = get().matchmaker
    if (m?.full_name) return m.full_name.split(' ')[0]
    const email = get().session?.user?.email
    return email ? email.split('@')[0] : 'there'
  },

  setSession: (session) => set({ session }),
  setMatchmaker: (matchmaker) => set({ matchmaker }),

  // Load the matchmakers row that matches the auth user id.
  loadMatchmaker: async () => {
    const userId = get().session?.user?.id
    if (!userId) return
    const { data } = await supabase
      .from('matchmakers')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) set({ matchmaker: data })
  },

  // Wire Supabase auth → store. Returns the subscription for cleanup.
  init: async () => {
    let { data } = await supabase.auth.getSession()

    set({ session: data.session, initializing: false })
    if (data.session) await get().loadMatchmaker()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session })
      if (session) get().loadMatchmaker()
      else set({ matchmaker: null })
    })
    return sub.subscription
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, matchmaker: null })
  },
}))
