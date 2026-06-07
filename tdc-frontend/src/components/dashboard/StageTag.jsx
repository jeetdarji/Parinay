import { motion } from 'framer-motion'

// Stage → palette mapping. All colors from the Luxury/Editorial system.
const STAGE_STYLES = {
  New: 'bg-[#EBE5DE] text-[#6C6863]',
  'Profile Verified': 'bg-[#1A1A1A] text-[#F9F8F6]',
  'Active - Searching': 'bg-[#D4AF37]/15 text-[#1A1A1A]',
  'Intro Sent': 'bg-[#1A1A1A]/8 text-[#1A1A1A]',
  'Date Completed': 'bg-[#D4AF37]/25 text-[#1A1A1A]',
  'Feedback Pending': 'bg-[#D4AF37]/10 text-[#6C6863]',
  'Re-matching': 'bg-[#EBE5DE] text-[#6C6863]',
  Matched: 'bg-[#1A1A1A] text-[#D4AF37]',
  'On Hold': 'bg-[#EBE5DE]/60 text-[#6C6863]',
  Closed: 'bg-[#EBE5DE]/40 text-[#6C6863]',
}

/** Compact rectangular stage badge. Re-animates on stage change. */
export default function StageTag({ stage }) {
  const styles = STAGE_STYLES[stage] || 'bg-[#EBE5DE] text-[#6C6863]'
  return (
    <motion.span
      key={stage}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`inline-flex items-center rounded-none px-3 py-1 font-inter text-[10px] font-medium uppercase tracking-[0.2em] ${styles}`}
    >
      {stage || 'New'}
    </motion.span>
  )
}
