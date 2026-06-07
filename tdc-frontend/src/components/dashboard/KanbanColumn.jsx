import { useDroppable, useDraggable } from '@dnd-kit/core'
import { useNavigate } from 'react-router-dom'
import AlertBadge from './AlertBadge'
import { getInitials } from '../../utils/formatters'

// Per-stage top-border accent (mirrors the StageTag color system).
const HEADER_ACCENT = {
  'Active - Searching': 'border-t-[#D4AF37]/60',
  'Intro Sent': 'border-t-[#1A1A1A]/30',
  'Date Completed': 'border-t-[#D4AF37]',
  Matched: 'border-t-[#D4AF37]',
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysInStage(client) {
  // Best-effort: time since last contact (proxy for time in current stage).
  const ref = client.last_contacted_at || client.created_at
  if (!ref) return null
  const d = Math.floor((Date.now() - new Date(ref).getTime()) / MS_PER_DAY)
  return d < 0 ? 0 : d
}

function DraggableCard({ client }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: client.id,
  })

  const days = daysInStage(client)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging) navigate(`/client/${client.id}`)
      }}
      className={`mb-2 cursor-grab border border-[#1A1A1A]/8 bg-[#F9F8F6] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] active:cursor-grabbing ${
        isDragging
          ? 'scale-[1.02] opacity-50 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
          : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#EBE5DE] font-inter text-[11px] font-medium text-[#6C6863]">
          {getInitials(client.first_name, client.last_name)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-inter text-[15px] font-medium text-[#1A1A1A]">
            {client.first_name} {client.last_name}
          </p>
          <p className="truncate font-inter text-xs text-[#6C6863]">
            {[client.age, client.city].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <AlertBadge
          lastContactedAt={client.last_contacted_at}
          stage={client.stage}
          createdAt={client.created_at}
        />
        {days !== null && (
          <span className="font-inter text-[11px] text-[#6C6863]/60">
            {days} day{days === 1 ? '' : 's'} in stage
          </span>
        )}
      </div>
    </div>
  )
}

export default function KanbanColumn({ stage, clients }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const accent = HEADER_ACCENT[stage] || 'border-t-[#1A1A1A]/15'

  return (
    <div className="flex w-[260px] min-w-[260px] flex-col">
      {/* Header */}
      <div
        className={`sticky top-0 z-10 mb-4 border-t-2 ${accent} border-b border-[#1A1A1A]/10 bg-[#F9F8F6] pb-3 pt-2`}
      >
        <div className="flex items-center">
          <span className="font-inter text-[11px] uppercase tracking-[0.25em] text-[#6C6863]">
            {stage}
          </span>
          <span className="ml-2 bg-[#1A1A1A]/8 px-2 py-0.5 font-inter text-[11px] font-medium text-[#6C6863]">
            {clients.length}
          </span>
        </div>
      </div>

      {/* Drop zone body */}
      <div
        ref={setNodeRef}
        className={`min-h-[120px] flex-1 transition-colors duration-200 ${
          isOver
            ? 'border border-dashed border-[#1A1A1A]/20 bg-[#EBE5DE]/60'
            : ''
        }`}
      >
        {clients.map((client) => (
          <DraggableCard key={client.id} client={client} />
        ))}
      </div>
    </div>
  )
}
