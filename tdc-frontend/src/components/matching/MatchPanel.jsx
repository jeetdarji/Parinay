import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMatches } from '../../hooks/useMatches'
import { useScopedLenis } from '../../hooks/useLenis'
import MatchCard from './MatchCard'
import SendMatchModal from '../modals/SendMatchModal'

// --- Loading sub-states ----------------------------------------------------

function NormalLoading({ text }) {
  return (
    <div className="py-8">
      <div className="flex flex-col gap-3">
        <div className="h-2 w-4/5 animate-pulse bg-[#EBE5DE]" />
        <div className="h-2 w-2/5 animate-pulse bg-[#EBE5DE]" />
        <div className="h-2 w-3/5 animate-pulse bg-[#EBE5DE]" />
      </div>
      <p className="mt-6 font-playfair text-base italic text-[#6C6863]">{text}</p>
    </div>
  )
}

function WakingUp() {
  return (
    <div className="py-8">
      <p className="font-playfair text-lg italic text-[#6C6863]">
        The matching engine is waking up.
      </p>
      <p className="mt-2 font-inter text-xs uppercase tracking-[0.15em] text-[#6C6863]/60">
        This takes a moment on first use each day.
      </p>
      <div className="relative mt-6 h-px w-full overflow-hidden bg-[#EBE5DE]">
        <span className="shimmer-slide absolute inset-y-0 left-0 h-px w-1/2 bg-[#D4AF37]/50" />
      </div>
    </div>
  )
}

// --- Main panel ------------------------------------------------------------

export default function MatchPanel({ client, clientId }) {
  const {
    triggerMatch,
    matchData,
    isMatching,
    isWakingUp,
    matchError,
    dummyPool,
    isDummyPoolLoading,
  } = useMatches(clientId, client)

  const [sentMatchIds, setSentMatchIds] = useState(new Set())
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const scrollRef = useRef(null)
  useScopedLenis(scrollRef, { duration: 0.8, enabled: !!matchData })

  // ----- ERROR STATE -----
  if (matchError && !isMatching) {
    const unavailable = matchError.message === 'SERVICE_UNAVAILABLE'
    return (
      <div className="border border-[#1A1A1A]/8 bg-[#EBE5DE]/30 p-8">
        <p className="font-playfair text-base italic text-[#6C6863]">
          {unavailable
            ? 'The matching engine is temporarily unavailable.'
            : 'Something went wrong with the match request.'}
        </p>
        <p className="mt-2 font-inter text-xs uppercase tracking-[0.15em] text-[#6C6863]/60">
          {unavailable ? 'Please try again in a few minutes.' : 'Please try again.'}
        </p>
        <button
          type="button"
          onClick={() => triggerMatch()}
          className="mt-6 h-10 border border-[#1A1A1A] px-6 font-inter text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A] transition-colors duration-500 hover:bg-[#1A1A1A] hover:text-[#F9F8F6]"
        >
          Try Again
        </button>
      </div>
    )
  }

  // ----- LOADING STATES -----
  if (isMatching) {
    return (
      <div className="border border-[#1A1A1A]/8 bg-[#EBE5DE]/20 p-8">
        {isWakingUp ? (
          <WakingUp />
        ) : (
          <NormalLoading text="Analysing compatibility across 8 dimensions..." />
        )}
      </div>
    )
  }

  // ----- RESULTS STATE -----
  if (matchData) {
    const scored = matchData.matches?.length ?? 0
    return (
      <div>
        <div className="flex items-end justify-between border-b border-[#1A1A1A]/15 pb-3">
          <h3 className="font-playfair text-xl text-[#1A1A1A]">Top Matches</h3>
          <span className="font-inter text-[10px] uppercase tracking-[0.2em] text-[#6C6863]">
            {scored} found · {matchData.hard_filtered_out ?? 0} filtered
          </span>
        </div>

        {scored === 0 ? (
          <p className="py-10 font-playfair text-base italic text-[#6C6863]">
            No suitable matches in the current pool.
          </p>
        ) : (
          <div
            ref={scrollRef}
            data-lenis-prevent
            className="editorial-scroll max-h-[calc(100vh-280px)] overflow-y-auto"
          >
            <AnimatePresence>
              {matchData.matches.map((match, i) => (
                <MatchCard
                  key={match.profile_id || `idx-${i}`}
                  match={match}
                  index={i}
                  isSent={sentMatchIds.has(match.profile_id)}
                  onSendMatch={(m) => {
                    setSelectedMatch(m)
                    setIsModalOpen(true)
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        <button
          type="button"
          onClick={() => triggerMatch()}
          className="mt-6 font-inter text-[10px] uppercase tracking-[0.2em] text-[#6C6863] transition-colors duration-300 hover:text-[#1A1A1A]"
        >
          Re-run Matching
        </button>

        <AnimatePresence>
          {isModalOpen && (
            <SendMatchModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              match={selectedMatch}
              clientProfile={client}
              onSent={(profileId) =>
                setSentMatchIds((prev) => new Set(prev).add(profileId))
              }
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ----- PRE-RESULTS (idle) STATE -----
  return (
    <div className="flex min-h-75 flex-col items-center justify-center border border-[#1A1A1A]/8 bg-[#EBE5DE]/30 p-8 text-center">
      <p className="font-playfair text-lg italic text-[#6C6863]">
        Ready to find the right introduction.
      </p>
      <p className="mt-2 font-inter text-[10px] uppercase tracking-[0.2em] text-[#6C6863]/60">
        {isDummyPoolLoading
          ? 'Loading matching pool...'
          : `${dummyPool.length} profiles in the matching pool`}
      </p>
      <button
        type="button"
        onClick={() => triggerMatch()}
        disabled={isDummyPoolLoading || dummyPool.length === 0}
        className="group relative mt-8 h-12 overflow-hidden bg-[#1A1A1A] px-10 font-inter text-[10px] uppercase tracking-[0.3em] text-[#F9F8F6] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-shadow duration-500 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] disabled:opacity-40"
      >
        <span className="absolute inset-0 -translate-x-full bg-[#D4AF37] transition-transform duration-500 ease-out group-hover:translate-x-0" />
        <span className="relative z-10">Find Matches</span>
      </button>
    </div>
  )
}
