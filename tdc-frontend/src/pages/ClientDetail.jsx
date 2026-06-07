import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import Lenis from '@studio-freight/lenis'
import { useClientDetail } from '../hooks/useClientDetail'
import ProfileCard from '../components/client/ProfileCard'
import StageChanger from '../components/client/StageChanger'
import AddNoteForm from '../components/client/AddNoteForm'
import NotesList from '../components/client/NotesList'
import MatchHistory from '../components/client/MatchHistory'
import MatchPanel from '../components/matching/MatchPanel'
import { formatNoteDate } from '../utils/formatters'

function BackLink() {
  const navigate = useNavigate()
  return (
    <div className="border-b border-[#1A1A1A]/8 px-8 py-6 md:px-16">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="font-inter text-[10px] uppercase tracking-[0.25em] text-[#6C6863] transition-colors duration-300 hover:text-[#1A1A1A]"
      >
        ← All Clients
      </button>
    </div>
  )
}

function StageTimeline({ stageHistory }) {
  return (
    <div>
      <p className="mb-4 font-inter text-[10px] uppercase tracking-[0.3em] text-[#6C6863]">
        Stage Timeline
      </p>
      {stageHistory.length === 0 ? (
        <p className="font-playfair text-base italic text-[#6C6863]">
          No stage changes recorded.
        </p>
      ) : (
        <div className="relative">
          {stageHistory.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2">
              <span className="h-1 w-1 shrink-0 bg-[#1A1A1A]/40" />
              <span className="font-inter text-sm text-[#1A1A1A]">
                {s.old_stage || 'Start'}
              </span>
              <span className="font-inter text-[#6C6863]">→</span>
              <span className="font-inter text-sm text-[#1A1A1A]">
                {s.new_stage}
              </span>
              <span className="ml-auto font-inter text-[11px] text-[#6C6863]">
                {formatNoteDate(s.changed_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid grid-cols-12 gap-8 px-8 pt-8 md:px-16">
      <div className="col-span-12 md:col-span-4">
        <div className="h-150 animate-pulse bg-[#EBE5DE]" />
      </div>
      <div className="col-span-12 space-y-6 md:col-span-4">
        <div className="h-40 animate-pulse bg-[#EBE5DE]" />
        <div className="h-40 animate-pulse bg-[#EBE5DE]" />
        <div className="h-40 animate-pulse bg-[#EBE5DE]" />
      </div>
      <div className="col-span-12 md:col-span-4">
        <div className="h-72 animate-pulse bg-[#EBE5DE]" />
      </div>
    </div>
  )
}

function ErrorState() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <p className="font-playfair text-2xl italic text-[#6C6863]">
        This client profile could not be loaded.
      </p>
      <p className="mt-3 font-inter text-xs uppercase tracking-[0.15em] text-[#6C6863]/60">
        Please return to the dashboard and try again
      </p>
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="mt-8 h-12 border border-[#1A1A1A] px-8 font-inter text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A] transition-colors duration-500 hover:bg-[#1A1A1A] hover:text-[#F9F8F6]"
      >
        Back to Dashboard
      </button>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const leftColRef = useRef(null)
  const { client, notes, stageHistory, matchRecords, isLoading, isError } =
    useClientDetail(id)

  // Inertia scroll on the left (profile) column only.
  useEffect(() => {
    const el = leftColRef.current
    if (!el || isLoading || isError || window.innerWidth < 768) return
    const lenis = new Lenis({
      wrapper: el,
      content: el,
      duration: 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    })
    let raf
    const loop = (time) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [isLoading, isError])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6]">
        <BackLink />
        <LoadingState />
      </div>
    )
  }

  if (isError || !client) {
    return (
      <div className="min-h-screen bg-[#F9F8F6]">
        <BackLink />
        <ErrorState />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      <BackLink />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="grid grid-cols-12 items-start gap-8 px-8 pb-24 pt-8 md:px-16"
      >
        {/* LEFT — profile + stage changer (sticky, inertia scroll) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="col-span-12 md:sticky md:top-8 md:col-span-4"
        >
          <p className="mb-2 font-inter text-[10px] uppercase tracking-[0.3em] text-[#6C6863]">
            Stage
          </p>
          <StageChanger clientId={id} stage={client.stage} />
          <div
            ref={leftColRef}
            className="editorial-scroll mt-8 overflow-y-auto md:max-h-[calc(100vh-180px)]"
          >
            <ProfileCard client={client} />
          </div>
        </motion.div>

        {/* MIDDLE — notes + timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="col-span-12 md:col-span-4"
        >
          <h3 className="mb-2 font-playfair text-xl text-[#1A1A1A]">
            Notes &amp; Timeline
          </h3>
          <div className="mb-6 h-px bg-[#1A1A1A]/15" />

          <AddNoteForm clientId={id} />
          <div className="my-6 h-px bg-[#1A1A1A]/8" />
          <NotesList notes={notes} />
          <div className="my-6 h-px bg-[#1A1A1A]/8" />
          <StageTimeline stageHistory={stageHistory} />
          <div className="my-6 h-px bg-[#1A1A1A]/8" />
          <MatchHistory matchRecords={matchRecords} />
        </motion.div>

        {/* RIGHT — matching panel (Phase 5C) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          className="col-span-12 md:col-span-4"
        >
          <MatchPanel client={client} clientId={id} />
        </motion.div>
      </motion.div>
    </div>
  )
}
