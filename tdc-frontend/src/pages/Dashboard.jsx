import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useClients } from '../hooks/useClients'
import { useCheckInAlerts } from '../hooks/useCheckInAlerts'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { formatHeaderDate } from '../utils/formatters'
import ClientTable from '../components/dashboard/ClientTable'
import KanbanBoard from '../components/dashboard/KanbanBoard'
import DailyDigest from '../components/dashboard/DailyDigest'

const STAGE_FILTERS = [
  { label: 'All', match: null },
  { label: 'Active', match: 'Active - Searching' },
  { label: 'Intro Sent', match: 'Intro Sent' },
  { label: 'Feedback Pending', match: 'Feedback Pending' },
  { label: 'Matched', match: 'Matched' },
]

function DigestStrip({ alerts }) {
  const items = [
    { count: alerts.overdue.length, label: 'Overdue' },
    { count: alerts.dueSoon.length, label: 'Due Soon' },
    { count: alerts.needsFeedback.length, label: 'Awaiting Feedback' },
  ]
  const allClear = items.every((i) => i.count === 0)

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 bg-[#1A1A1A] px-6 py-4 text-[#F9F8F6] md:px-16">
      {allClear ? (
        <p className="font-playfair text-lg italic text-[#EBE5DE]/70">
          All clients attended to.
        </p>
      ) : (
        items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-8">
            {i > 0 && <span className="hidden h-4 w-px bg-[#F9F8F6]/20 sm:block" />}
            <div className="flex items-baseline gap-3">
              <span className="font-playfair text-2xl">{item.count}</span>
              <span className="font-inter text-[11px] uppercase tracking-[0.2em] text-[#EBE5DE]/70">
                {item.label}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default function Dashboard() {
  const firstName = useAuthStore((s) => s.firstName())
  const view = useUIStore((s) => s.activeView)
  const setView = useUIStore((s) => s.setActiveView)

  const { data: clients = [], isLoading, isError } = useClients()
  const alerts = useCheckInAlerts(clients)

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return clients.filter((c) => {
      const matchesStage = !stageFilter || c.stage === stageFilter
      if (!matchesStage) return false
      if (!term) return true
      const haystack = `${c.first_name || ''} ${c.last_name || ''} ${c.city || ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [clients, search, stageFilter])

  const resultsLabel = search.trim()
    ? `${filtered.length} client${filtered.length === 1 ? '' : 's'} matching "${search.trim()}"`
    : `${filtered.length} client${filtered.length === 1 ? '' : 's'}`

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="flex min-h-screen bg-[#F9F8F6]">
      {/* Daily Digest sidebar — desktop only (mobile uses the digest strip). */}
      <div className="hidden md:flex">
        <DailyDigest alerts={alerts} />
      </div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="min-w-0 flex-1"
      >
        {/* PAGE HEADER */}
        <div className="flex flex-col gap-4 px-6 py-10 sm:flex-row sm:items-start sm:justify-between md:px-16 md:py-12">
          <div>
            <div className="flex items-center">
              <span className="mr-3 inline-block h-px w-8 bg-[#1A1A1A]/30" />
              <span className="font-inter text-[11px] uppercase tracking-[0.3em] text-[#6C6863]">
                TDC Matchmaker
              </span>
            </div>
            <h1 className="mt-4 font-playfair text-4xl text-[#1A1A1A] md:text-5xl">
              {greeting}, <span className="italic">{firstName}.</span>
            </h1>
          </div>
          <span className="font-inter text-[11px] uppercase tracking-[0.25em] text-[#6C6863] md:text-xs">
            {formatHeaderDate()}
          </span>
        </div>

        {/* DAILY DIGEST STRIP */}
        <DigestStrip alerts={alerts} />

        {/* MAIN CONTENT */}
        <div className="px-6 pt-8 md:px-16">
          {/* View toggle */}
          <div className="mb-6 flex justify-end gap-6">
            {[
              { key: 'table', label: 'List View' },
              { key: 'kanban', label: 'Kanban' },
            ].map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`pb-1 font-inter text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 ${
                  view === v.key
                    ? 'border-b border-[#1A1A1A] text-[#1A1A1A]'
                    : 'text-[#6C6863]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {view === 'kanban' ? (
            <div className="pb-24">
              {isLoading ? (
                <p className="py-24 font-playfair text-xl italic text-[#6C6863]">
                  Preparing the pipeline...
                </p>
              ) : (
                <KanbanBoard clients={clients} />
              )}
            </div>
          ) : (
            <>
              {/* Search + filter bar */}
              <div className="flex flex-col gap-6 border-b border-[#1A1A1A]/10 pb-6 md:flex-row md:items-center">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or city..."
                  className="editorial-placeholder w-full border-b border-[#1A1A1A] bg-transparent px-0 py-2 font-inter text-[15px] text-[#1A1A1A] outline-none transition-colors duration-300 focus:border-[#D4AF37] md:w-72"
                />
                <div className="flex flex-wrap gap-3">
                  {STAGE_FILTERS.map((f) => {
                    const active = stageFilter === f.match
                    return (
                      <button
                        key={f.label}
                        type="button"
                        onClick={() => setStageFilter(f.match)}
                        className={`rounded-none px-4 py-2 font-inter text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 ease-out ${
                          active
                            ? 'bg-[#1A1A1A] text-[#F9F8F6]'
                            : 'border border-[#1A1A1A]/20 bg-transparent text-[#6C6863]'
                        }`}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {!isLoading && (
                <p className="py-3 font-inter text-xs uppercase tracking-[0.15em] text-[#6C6863]">
                  {resultsLabel}
                </p>
              )}

              <div className="overflow-x-auto pb-24">
                <ClientTable
                  clients={filtered}
                  isLoading={isLoading}
                  isError={isError}
                />
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
