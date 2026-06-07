import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import StageTag from './StageTag'
import AlertBadge from './AlertBadge'
import { formatRelativeTime, getInitials } from '../../utils/formatters'

// Shared 12-col grid template so header + rows align perfectly.
const GRID = 'grid grid-cols-[2.6fr_0.7fr_1.3fr_1.6fr_1.4fr_1fr] items-center gap-4 min-w-[720px]'

function HeaderRow() {
  return (
    <div
      className={`${GRID} border-b border-[#1A1A1A]/15 px-6 py-4 font-inter text-[11px] font-medium uppercase tracking-[0.3em] text-[#6C6863]`}
    >
      <span>Client</span>
      <span>Age</span>
      <span>City</span>
      <span>Stage</span>
      <span>Last Contact</span>
      <span>Alert</span>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className={`${GRID} border-b border-[#1A1A1A]/8 px-6 py-5`}>
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 animate-pulse bg-[#EBE5DE]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 animate-pulse bg-[#EBE5DE]" />
          <div className="h-2 w-20 animate-pulse bg-[#EBE5DE]" />
        </div>
      </div>
      <div className="h-3 w-6 animate-pulse bg-[#EBE5DE]" />
      <div className="h-3 w-20 animate-pulse bg-[#EBE5DE]" />
      <div className="h-5 w-24 animate-pulse bg-[#EBE5DE]" />
      <div className="h-3 w-16 animate-pulse bg-[#EBE5DE]" />
      <div className="h-4 w-14 animate-pulse bg-[#EBE5DE]" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start px-6 py-24">
      <p className="font-playfair text-2xl italic text-[#6C6863]">
        Your client roster awaits.
      </p>
      <p className="mt-3 font-inter text-sm uppercase tracking-[0.15em] text-[#6C6863]">
        No clients assigned yet
      </p>
    </div>
  )
}

export default function ClientTable({ clients, isLoading, isError }) {
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div>
        <HeaderRow />
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="px-6 py-24">
        <p className="font-playfair text-2xl italic text-[#6C6863]">
          The roster could not be loaded.
        </p>
        <p className="mt-3 font-inter text-sm uppercase tracking-[0.15em] text-[#6C6863]">
          Please refresh and try again
        </p>
      </div>
    )
  }

  if (!clients || clients.length === 0) {
    return (
      <div>
        <HeaderRow />
        <EmptyState />
      </div>
    )
  }

  return (
    <div>
      <HeaderRow />
      <AnimatePresence>
        {clients.map((client, index) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: index * 0.04, ease: 'easeOut' }}
            onClick={() => navigate(`/client/${client.id}`)}
            className={`${GRID} cursor-pointer border-b border-[#1A1A1A]/8 px-6 py-5 transition-colors duration-500 ease-out hover:bg-[#EBE5DE]/40`}
          >
            {/* CLIENT */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#EBE5DE] font-inter text-xs font-medium text-[#6C6863]">
                {getInitials(client.first_name, client.last_name)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-inter text-sm font-medium text-[#1A1A1A]">
                  {client.first_name} {client.last_name}
                </p>
                <p className="truncate font-inter text-[11px] text-[#6C6863]">
                  {client.marital_status || '—'}
                </p>
              </div>
            </div>

            {/* AGE */}
            <span className="font-inter text-sm text-[#1A1A1A]">
              {client.age ?? '—'}
            </span>

            {/* CITY */}
            <span className="truncate font-inter text-sm text-[#6C6863]">
              {client.city || '—'}
            </span>

            {/* STAGE */}
            <div>
              <StageTag stage={client.stage} />
            </div>

            {/* LAST CONTACT */}
            <span className="font-inter text-sm text-[#6C6863]">
              {formatRelativeTime(client.last_contacted_at)}
            </span>

            {/* ALERT */}
            <div>
              <AlertBadge
                lastContactedAt={client.last_contacted_at}
                stage={client.stage}
                createdAt={client.created_at}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
