import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import ScoreBadge from './ScoreBadge'
import ScoreBreakdown from './ScoreBreakdown'

export default function MatchCard({ match, onSendMatch, isSent, index = 0 }) {
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      className="-mx-4 border-t border-[#1A1A1A]/10 px-4 pb-4 pt-5 transition-colors duration-500 hover:bg-[#EBE5DE]/20"
    >
      {/* Top row: name + score badge */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-inter text-sm font-medium text-[#1A1A1A]">
            {match.first_name} {match.last_name}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span className="font-inter text-[11px] text-[#6C6863]">
              {match.age ?? '—'}
            </span>
            <span className="text-[#6C6863]/40">·</span>
            <span className="font-inter text-[11px] text-[#6C6863]">
              {match.city || '—'}
            </span>
          </div>
        </div>
        <ScoreBadge label={match.score_label} score={match.score} />
      </div>

      {/* Designation · Company */}
      <p className="mt-1.5 font-inter text-[11px] text-[#6C6863]">
        {[match.designation, match.current_company].filter(Boolean).join(' · ') || '—'}
      </p>

      {/* Action row: breakdown trigger + send button */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsBreakdownOpen((o) => !o)}
          className="group flex items-center gap-2"
        >
          <span className="font-inter text-[9px] uppercase tracking-[0.25em] text-[#6C6863] transition-colors duration-300 group-hover:text-[#1A1A1A]">
            Score Breakdown
          </span>
          <ChevronDown
            size={12}
            strokeWidth={1.5}
            className={`text-[#6C6863] transition-transform duration-300 ${
              isBreakdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isSent ? (
          <span className="flex items-center gap-2">
            <span className="h-px w-3 bg-[#D4AF37]" />
            <span className="font-inter text-[9px] uppercase tracking-[0.2em] text-[#D4AF37]">
              Sent
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onSendMatch(match)}
            className="h-8 border border-[#1A1A1A]/30 px-4 font-inter text-[9px] uppercase tracking-[0.2em] text-[#1A1A1A] transition-all duration-400 hover:bg-[#1A1A1A] hover:text-[#F9F8F6]"
          >
            Send Match
          </button>
        )}
      </div>

      {/* Breakdown panel */}
      <ScoreBreakdown breakdown={match.score_breakdown} isOpen={isBreakdownOpen} />
    </motion.div>
  )
}
