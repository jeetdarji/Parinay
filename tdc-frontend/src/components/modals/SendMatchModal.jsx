import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import ScoreBadge from '../matching/ScoreBadge'
import { api } from '../../lib/axios'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'

const EASE = [0.25, 0.46, 0.45, 0.94]

export default function SendMatchModal({ isOpen, onClose, match, clientProfile, onSent }) {
  const userId = useAuthStore((s) => s.session?.user?.id)
  const queryClient = useQueryClient()

  const [explanation, setExplanation] = useState(null)
  const [isExplaining, setIsExplaining] = useState(true)
  const [isFallback, setIsFallback] = useState(false)
  const [emailText, setEmailText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const mountedRef = useRef(true)

  // Fetch the AI explanation once when the drawer mounts.
  const fetchExplanation = async () => {
    setIsExplaining(true)
    setIsFallback(false)
    try {
      const res = await api.post('/ai/explain-match', {
        client_profile: clientProfile,
        match_profile: match,
        computed_signals: {},
      })
      const data = res.data
      if (!mountedRef.current) return
      setExplanation(data)
      setIsFallback(!!data.is_fallback)
      if (data.intro_email_draft) setEmailText(data.intro_email_draft)
    } catch {
      if (!mountedRef.current) return
      setExplanation(null)
      setIsFallback(true)
    } finally {
      if (mountedRef.current) setIsExplaining(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    fetchExplanation()
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape to close.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll and pause global Lenis to prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    if (window.lenis) window.lenis.stop()
    return () => {
      document.body.style.overflow = 'unset'
      if (window.lenis) window.lenis.start()
    }
  }, [])

  const handleSend = async () => {
    if (!emailText.trim() || isSending) return
    setIsSending(true)
    const { error } = await supabase.from('match_records').insert({
      client_id: clientProfile.id,
      matched_with_id: match.profile_id,
      match_score: match.score,
      score_label: match.score_label,
      ai_headline: explanation?.headline || null,
      ai_explanation: explanation || null,
      intro_email_sent: emailText,
      sent_at: new Date().toISOString(),
      sent_by: userId,
    })
    setIsSending(false)

    if (error) {
      toast.error('Failed to send. Please try again.')
      return
    }
    onSent?.(match.profile_id)
    queryClient.invalidateQueries({ queryKey: ['match_records', clientProfile.id] })
    toast.success(`Introduction sent to ${match.first_name}`)
    onClose()
  }

  if (!match) return null

  const metaParts = [match.age, match.city, match.designation, match.current_company]
    .filter(Boolean)

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-[2px]"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.45, ease: EASE }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-145 flex-col border-l border-[#1A1A1A]/10 bg-[#F9F8F6] shadow-[-8px_0_32px_rgba(0,0,0,0.08)]"
      >
        {/* Scrollable content (flex-1) */}
        <div 
          className="flex-1 overflow-y-auto" 
          data-lenis-prevent 
          style={{ overscrollBehavior: 'contain' }}
        >
          {/* SECTION 1 — match summary */}
          <div className="relative border-b border-[#1A1A1A]/10 px-8 pb-6 pt-8">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-6 top-6 text-[#6C6863] transition-colors duration-300 hover:text-[#1A1A1A]"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
            <p className="mb-3 font-inter text-[9px] uppercase tracking-[0.3em] text-[#6C6863]">
              Proposed Introduction
            </p>
            <h2 className="font-playfair text-2xl text-[#1A1A1A]">
              {match.first_name} {match.last_name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 font-inter text-[11px] text-[#6C6863]">
              {metaParts.map((p, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[#6C6863]/30">·</span>}
                  {p}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <ScoreBadge label={match.score_label} score={match.score} />
            </div>
          </div>

          {/* SECTION 2 — AI explanation */}
          <div className="border-b border-[#1A1A1A]/10 px-8 py-6">
            {isExplaining ? (
              <div>
                <p className="mb-4 font-inter text-[9px] uppercase tracking-[0.25em] text-[#6C6863]">
                  Generating Compatibility Analysis...
                </p>
                <div className="h-6 w-3/4 animate-pulse bg-[#EBE5DE]" />
                <div className="mt-4 flex flex-col gap-2">
                  <div className="h-4 w-full animate-pulse bg-[#EBE5DE]" />
                  <div className="h-4 w-full animate-pulse bg-[#EBE5DE]" />
                  <div className="h-4 w-2/3 animate-pulse bg-[#EBE5DE]" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-6 w-16 animate-pulse bg-[#EBE5DE]" />
                  <div className="h-6 w-16 animate-pulse bg-[#EBE5DE]" />
                  <div className="h-6 w-16 animate-pulse bg-[#EBE5DE]" />
                </div>
              </div>
            ) : explanation && !isFallback ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <p className="mb-2 font-inter text-[9px] uppercase tracking-[0.25em] text-[#D4AF37]">
                  Why This Introduction Works
                </p>
                <h3 className="mb-4 font-playfair text-xl leading-snug text-[#1A1A1A]">
                  {explanation.headline}
                </h3>
                <div className="mb-5 flex flex-col gap-3">
                  {(explanation.why_this_works || []).map((point, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-2 h-1 w-1 shrink-0 bg-[#D4AF37]" />
                      <p className="font-inter text-sm leading-relaxed text-[#1A1A1A]">
                        {point}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(explanation.talking_points || []).map((tp, i) => (
                    <span
                      key={i}
                      className="border border-[#1A1A1A]/20 px-3 py-1 font-inter text-[10px] uppercase tracking-[0.15em] text-[#6C6863] transition-colors duration-300 hover:border-[#D4AF37] hover:text-[#1A1A1A]"
                    >
                      {tp}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="border-l-2 border-[#D4AF37]/40 bg-[#EBE5DE]/60 px-4 py-3">
                <p className="font-inter text-xs leading-relaxed text-[#6C6863]">
                  The AI explanation could not be generated. You can write your
                  introduction below or try again.
                </p>
                <button
                  type="button"
                  onClick={fetchExplanation}
                  className="mt-2 font-inter text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A] underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* SECTION 3 — intro email */}
          <div className="border-b border-[#1A1A1A]/10 px-8 py-6">
            <p className="mb-1 font-inter text-[9px] uppercase tracking-[0.3em] text-[#6C6863]">
              Draft Introduction Email
            </p>
            <p className="mb-4 font-inter text-[10px] text-[#6C6863]/60">
              Edit before sending
            </p>
            <textarea
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              placeholder="Begin your introduction here..."
              className="editorial-placeholder min-h-50 w-full resize-none border-b border-[#1A1A1A]/20 bg-transparent p-0 pt-2 font-inter text-sm leading-relaxed text-[#1A1A1A] outline-none transition-colors duration-300 focus:border-[#D4AF37]"
            />
            <p className="mt-2 text-right font-inter text-[10px] text-[#6C6863]/60">
              {emailText.length} characters
            </p>
          </div>
        </div>

        {/* SECTION 4 — sticky action row */}
        <div className="flex items-center justify-between border-t border-[#1A1A1A]/10 bg-[#F9F8F6] px-8 py-5">
          <button
            type="button"
            onClick={onClose}
            className="font-inter text-[9px] uppercase tracking-[0.2em] text-[#6C6863] transition-colors duration-300 hover:text-[#1A1A1A]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!emailText.trim() || isSending}
            className="group relative h-11 overflow-hidden bg-[#1A1A1A] px-8 font-inter text-[10px] uppercase tracking-[0.2em] text-[#F9F8F6] disabled:opacity-50"
          >
            <span className="absolute inset-0 -translate-x-full bg-[#D4AF37] transition-transform duration-500 ease-out group-hover:translate-x-0" />
            <span className="relative z-10">
              {isSending ? 'Sending...' : 'Send Introduction'}
            </span>
          </button>
        </div>
      </motion.div>
    </>
  )
}
