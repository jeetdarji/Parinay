import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useScopedLenis } from '../../hooks/useLenis'
import { formatHeaderDate } from '../../utils/formatters'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const daysAgo = (d) =>
  d ? Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / MS_PER_DAY)) : null

function ClientItem({ client, urgency, gold }) {
  const navigate = useNavigate()
  return (
    <div className="border-b border-[#F9F8F6]/5 px-5 py-3.5 transition-colors duration-300 hover:bg-[#F9F8F6]/5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-inter text-[15px] font-medium text-[#F9F8F6]">
            {client.first_name} {client.last_name}
          </p>
          <p
            className={`mt-1 font-inter text-[11px] ${
              gold ? 'text-[#D4AF37]/80' : 'text-[#EBE5DE]/60'
            }`}
          >
            {urgency}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/client/${client.id}`)}
          className="shrink-0 font-inter text-[10px] uppercase tracking-[0.2em] text-[#EBE5DE]/40 transition-colors duration-300 hover:text-[#D4AF37]"
        >
          View →
        </button>
      </div>
    </div>
  )
}

function Section({ label, count, badgeClass, children }) {
  if (count === 0) return null
  return (
    <div>
      <div className="px-5 pb-2 pt-5">
        <span className="font-inter text-[10px] uppercase tracking-[0.25em] text-[#EBE5DE]/50">
          {label}
        </span>
        <span className={`ml-2 px-2 py-0.5 font-playfair text-xl text-[#F9F8F6] ${badgeClass}`}>
          {count}
        </span>
      </div>
      {children}
    </div>
  )
}

export default function DailyDigest({ alerts }) {
  const isOpen = useUIStore((s) => s.isDailyDigestOpen)
  const toggle = useUIStore((s) => s.toggleDailyDigest)
  const panelRef = useRef(null)
  useScopedLenis(panelRef, { duration: 0.8, enabled: isOpen })

  const { overdue, dueSoon, needsFeedback, newWithoutMatch, totalAlerts } = alerts

  // COLLAPSED RAIL
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="sticky top-0 flex h-screen w-12 shrink-0 cursor-pointer flex-col items-center gap-4 self-start bg-[#1A1A1A] pt-8"
        aria-label="Open daily priorities"
      >
        {totalAlerts > 0 && (
          <span className="flex h-6 w-6 items-center justify-center bg-[#D4AF37] font-inter text-[11px] font-medium text-[#1A1A1A]">
            {totalAlerts}
          </span>
        )}
        <span className="vertical-rl rotate-180 font-inter text-[10px] uppercase tracking-[0.25em] text-[#F9F8F6]/60">
          Today&apos;s Priorities
        </span>
      </button>
    )
  }

  // EXPANDED PANEL
  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 48, opacity: 0 }}
        animate={{ width: 300, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="sticky top-0 h-screen shrink-0 self-start overflow-hidden bg-[#1A1A1A]"
      >
        <div
          ref={panelRef}
          data-lenis-prevent
          className="editorial-scroll h-full overflow-y-auto"
        >
          {/* Header */}
          <div className="relative border-b border-[#F9F8F6]/8 px-5 pb-4 pt-6">
            <p className="mb-1 font-inter text-[10px] uppercase tracking-[0.3em] text-[#EBE5DE]/60">
              Today&apos;s Priorities
            </p>
            <p className="font-playfair text-base italic text-[#F9F8F6]/80">
              {formatHeaderDate()}
            </p>
            <button
              type="button"
              onClick={toggle}
              className="absolute right-4 top-5 text-[#F9F8F6]/40 transition-colors duration-300 hover:text-[#F9F8F6]"
              aria-label="Collapse"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>

          {totalAlerts === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-playfair text-lg italic text-[#F9F8F6]/50">
                All clients attended to.
              </p>
              <p className="mt-2 font-inter text-[11px] uppercase tracking-[0.2em] text-[#F9F8F6]/30">
                Nothing urgent today
              </p>
            </div>
          ) : (
            <>
              <Section label="Overdue Check-ins" count={overdue.length} badgeClass="bg-[#F9F8F6]/10">
                {overdue.map((c) => {
                  const d = daysAgo(c.last_contacted_at)
                  return (
                    <ClientItem
                      key={c.id}
                      client={c}
                      gold={d !== null && d > 21}
                      urgency={d === null ? 'No recent contact' : `Last contact ${d} days ago`}
                    />
                  )
                })}
              </Section>

              <Section label="Needs Feedback" count={needsFeedback.length} badgeClass="bg-[#D4AF37]/20">
                {needsFeedback.map((c) => {
                  const d = daysAgo(c.last_contacted_at)
                  return (
                    <ClientItem
                      key={c.id}
                      client={c}
                      urgency={`Date completed ${d ?? '—'} days ago`}
                    />
                  )
                })}
              </Section>

              <Section label="Due Soon" count={dueSoon.length} badgeClass="bg-[#F9F8F6]/6">
                {dueSoon.map((c) => {
                  const d = daysAgo(c.last_contacted_at)
                  return (
                    <ClientItem
                      key={c.id}
                      client={c}
                      urgency={`Last contact ${d ?? '—'} days ago`}
                    />
                  )
                })}
              </Section>

              <Section label="New Without Match" count={newWithoutMatch.length} badgeClass="bg-[#F9F8F6]/6">
                {newWithoutMatch.map((c) => {
                  const d = daysAgo(c.created_at)
                  return (
                    <ClientItem
                      key={c.id}
                      client={c}
                      urgency={`Joined ${d ?? '—'} days ago · no match yet`}
                    />
                  )
                })}
              </Section>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
