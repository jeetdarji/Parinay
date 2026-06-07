import { motion } from 'framer-motion'

// Three rectangular treatments keyed off the score label, with a geometric
// square accent and a Playfair score number (intentional mixed typography).
const TREATMENTS = {
  'High Potential Match': {
    box: 'bg-[#D4AF37]/20 border border-[#D4AF37]/60 text-[#1A1A1A]',
    dot: 'bg-[#D4AF37]',
    short: 'High Potential',
  },
  'Good Match': {
    box: 'bg-[#1A1A1A]/6 border border-[#1A1A1A]/20 text-[#1A1A1A]',
    dot: 'bg-[#1A1A1A]/50',
    short: 'Good Match',
  },
  Possible: {
    box: 'bg-transparent border border-[#6C6863]/30 text-[#6C6863]',
    dot: 'bg-[#6C6863]/40',
    short: 'Possible',
  },
}

export default function ScoreBadge({ label, score }) {
  const t = TREATMENTS[label] || TREATMENTS['Good Match']
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`inline-flex items-center gap-2 rounded-none px-3 py-1.5 ${t.box}`}
    >
      <span className={`h-1 w-1 ${t.dot}`} />
      <span className="font-inter text-[10px] font-medium uppercase tracking-[0.2em]">
        {t.short}
      </span>
      {score !== undefined && score !== null && (
        <>
          <span className="text-[#6C6863]/50">·</span>
          <span className="font-playfair text-sm leading-none">{score}</span>
        </>
      )}
    </motion.span>
  )
}
