import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import KanbanColumn from './KanbanColumn'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useScopedLenis } from '../../hooks/useLenis'
import { getInitials } from '../../utils/formatters'

const STAGE_ORDER = [
  'New',
  'Profile Verified',
  'Active - Searching',
  'Intro Sent',
  'Date Completed',
  'Feedback Pending',
  'Re-matching',
  'Matched',
]

export default function KanbanBoard({ clients }) {
  const userId = useAuthStore((s) => s.session?.user?.id)
  const queryClient = useQueryClient()
  const boardRef = useRef(null)
  useScopedLenis(boardRef, { duration: 0.7, orientation: 'horizontal' })

  // Local optimistic copy so drags reflect instantly.
  const [localClients, setLocalClients] = useState(clients)
  const [activeId, setActiveId] = useState(null)

  useEffect(() => setLocalClients(clients), [clients])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Group clients by stage.
  const byStage = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, []]))
    for (const c of localClients) {
      if (map[c.stage]) map[c.stage].push(c)
      else map['New'].push(c) // safety net for unexpected stages
    }
    return map
  }, [localClients])

  const activeClient = activeId
    ? localClients.find((c) => c.id === activeId)
    : null

  // Supabase realtime — refetch on any profile update for this matchmaker.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('kanban-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `matchmaker_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['clients', userId] })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  const handleDragStart = (event) => setActiveId(event.active.id)

  const handleDragEnd = async (event) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const clientId = active.id
    const newStage = over.id
    const client = localClients.find((c) => c.id === clientId)
    if (!client || client.stage === newStage) return

    const previousStage = client.stage

    // 1. Optimistic update.
    setLocalClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage: newStage } : c))
    )

    // 2 + 3. Persist + audit.
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ stage: newStage })
      .eq('id', clientId)

    if (updateErr) {
      setLocalClients((prev) =>
        prev.map((c) =>
          c.id === clientId ? { ...c, stage: previousStage } : c
        )
      )
      toast.error('Could not move client')
      return
    }

    await supabase.from('stage_history').insert({
      client_id: clientId,
      old_stage: previousStage,
      new_stage: newStage,
      changed_by: userId,
      changed_at: new Date().toISOString(),
    })

    queryClient.invalidateQueries({ queryKey: ['clients', userId] })
    toast.success(`Moved to ${newStage}`)
  }

  // Pipeline summary (stages with > 0 clients).
  const summary = STAGE_ORDER.filter((s) => byStage[s].length > 0)
    .map((s) => `${byStage[s].length} ${s.replace('Active - Searching', 'Active')}`)
    .join(' · ')

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {summary && (
        <p className="mb-4 font-inter text-[11px] uppercase tracking-[0.2em] text-[#6C6863]">
          {summary}
        </p>
      )}
      <p className="mb-6 flex items-center gap-2 font-inter text-[10px] uppercase tracking-[0.2em] text-[#6C6863]/50">
        <span className="inline-block h-px w-6 bg-[#1A1A1A]/20" />
        Drag cards between stages · scroll sideways for more
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={boardRef}
          data-lenis-prevent
          className="kanban-scroll editorial-scroll flex gap-6 overflow-x-auto pb-6"
        >
          {STAGE_ORDER.map((stage) => (
            <KanbanColumn key={stage} stage={stage} clients={byStage[stage]} />
          ))}
        </div>

        <DragOverlay>
          {activeClient ? (
            <div className="w-[228px] border border-[#1A1A1A]/8 bg-[#F9F8F6] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center bg-[#EBE5DE] font-inter text-[10px] font-medium text-[#6C6863]">
                  {getInitials(activeClient.first_name, activeClient.last_name)}
                </div>
                <p className="font-inter text-sm font-medium text-[#1A1A1A]">
                  {activeClient.first_name} {activeClient.last_name}
                </p>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  )
}
