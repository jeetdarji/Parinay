import { clientAlertLevel } from '../../utils/alertComputer'

// Renders the single most-severe check-in alert, or nothing.
const LEVELS = {
  overdue: { label: 'OVERDUE', className: 'bg-[#1A1A1A] text-[#F9F8F6] animate-pulse' },
  dueSoon: { label: 'DUE SOON', className: 'border border-[#1A1A1A] text-[#1A1A1A] bg-transparent' },
  needsFeedback: { label: 'FEEDBACK', className: 'bg-[#D4AF37]/20 text-[#1A1A1A]' },
}

export default function AlertBadge({ lastContactedAt, stage, createdAt }) {
  const level = clientAlertLevel({ lastContactedAt, stage, createdAt })
  if (!level) return null

  const { label, className } = LEVELS[level]
  return (
    <span
      className={`inline-flex items-center rounded-none px-2 py-0.5 font-inter text-[9px] font-medium uppercase tracking-[0.2em] ${className}`}
    >
      {label}
    </span>
  )
}
