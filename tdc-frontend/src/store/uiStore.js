// Zustand UI store. Dashboard view toggle + daily digest panel state.
import { create } from 'zustand'

export const useUIStore = create((set) => ({
  activeView: 'table', // 'table' | 'kanban'
  isDailyDigestOpen: true,

  setActiveView: (view) => set({ activeView: view }),
  toggleDailyDigest: () =>
    set((s) => ({ isDailyDigestOpen: !s.isDailyDigestOpen })),
}))
