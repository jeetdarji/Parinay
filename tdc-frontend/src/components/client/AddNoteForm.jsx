import { useState } from 'react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

export default function AddNoteForm({ clientId }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const userId = useAuthStore((s) => s.session?.user?.id)
  const queryClient = useQueryClient()

  const trimmed = content.trim()
  const disabled = saving || trimmed.length === 0

  const handleSave = async () => {
    if (disabled) return
    setSaving(true)
    const { error } = await supabase.from('notes').insert({
      client_id: clientId,
      content: trimmed,
      matchmaker_id: userId,
    })
    setSaving(false)

    if (error) {
      toast.error('Could not save note')
      return
    }
    setContent('')
    // Notes list + last_contacted_at (trigger) both change.
    queryClient.invalidateQueries({ queryKey: ['notes', clientId] })
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
    toast.success('Note added')
  }

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Record an observation, outcome, or next step..."
        className="editorial-placeholder min-h-[80px] w-full resize-none border-b border-[#1A1A1A]/30 bg-transparent p-0 pt-2 font-inter text-sm leading-relaxed text-[#1A1A1A] outline-none transition-colors duration-300 focus:border-[#D4AF37]"
      />
      <div className="mt-3 flex items-center justify-end gap-4">
        <span className="font-inter text-[11px] text-[#6C6863]">
          {content.length} character{content.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled}
          className={`group relative h-10 overflow-hidden bg-[#1A1A1A] px-6 font-inter text-[10px] uppercase tracking-[0.2em] text-[#F9F8F6] ${
            disabled ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <span
            className="absolute inset-0 -translate-x-full bg-[#D4AF37] transition-transform duration-500 ease-out group-hover:translate-x-0"
            style={{ transitionTimingFunction: 'cubic-bezier(0.25,0.46,0.45,0.94)' }}
          />
          <span className="relative z-10">{saving ? 'Saving...' : 'Save Note'}</span>
        </button>
      </div>
    </div>
  )
}
