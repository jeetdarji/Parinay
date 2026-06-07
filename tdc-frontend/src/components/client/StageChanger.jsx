import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import StageTag from '../dashboard/StageTag'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const STAGES = [
  'New',
  'Profile Verified',
  'Active - Searching',
  'Intro Sent',
  'Date Completed',
  'Feedback Pending',
  'Re-matching',
  'Matched',
  'On Hold',
  'Closed',
]

export default function StageChanger({ clientId, stage }) {
  const [open, setOpen] = useState(false)
  const [localStage, setLocalStage] = useState(stage)
  const containerRef = useRef(null)
  const userId = useAuthStore((s) => s.session?.user?.id)
  const queryClient = useQueryClient()

  // Keep local stage in sync if the server value changes underneath us.
  useEffect(() => setLocalStage(stage), [stage])

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const changeStage = async (newStage) => {
    if (newStage === localStage) {
      setOpen(false)
      return
    }
    const previous = localStage
    setLocalStage(newStage) // optimistic
    setOpen(false)

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ stage: newStage })
      .eq('id', clientId)

    if (updateErr) {
      setLocalStage(previous)
      toast.error('Could not update stage')
      return
    }

    await supabase.from('stage_history').insert({
      client_id: clientId,
      old_stage: previous,
      new_stage: newStage,
      changed_by: userId,
    })

    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    queryClient.invalidateQueries({ queryKey: ['stage_history', clientId] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    toast.success(`Stage updated to ${newStage}`)
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex cursor-pointer items-center gap-2"
      >
        <StageTag stage={localStage} />
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className="text-[#6C6863] transition-colors duration-300 group-hover:text-[#D4AF37]"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scaleY: 0.97 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ transformOrigin: 'top' }}
            className="absolute left-0 z-30 mt-2 min-w-48 border border-[#1A1A1A]/15 bg-[#F9F8F6] shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
          >
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeStage(s)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left font-inter text-sm text-[#1A1A1A] transition-colors duration-200 hover:bg-[#EBE5DE]/60"
              >
                {s === localStage && (
                  <span className="h-1 w-1 shrink-0 bg-[#D4AF37]" />
                )}
                <span className={s === localStage ? '' : 'pl-3'}>{s}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
