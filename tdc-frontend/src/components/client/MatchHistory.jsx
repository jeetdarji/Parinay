import { formatNoteDate } from '../../utils/formatters'

// Score dot color by band (stub for the ScoreBadge built in Phase 5C).
function scoreDot(score) {
  if (score >= 80) return 'bg-[#D4AF37]'
  if (score >= 60) return 'bg-[#1A1A1A]'
  return 'bg-[#6C6863]'
}

export default function MatchHistory({ matchRecords = [] }) {
  return (
    <div>
      <p className="mb-4 font-inter text-[10px] uppercase tracking-[0.3em] text-[#6C6863]">
        Introduction History
      </p>
      <div className="mb-4 h-px bg-[#1A1A1A]/10" />

      {matchRecords.length === 0 ? (
        <p className="font-playfair text-base italic text-[#6C6863]">
          No introductions sent yet.
        </p>
      ) : (
        <div>
          {matchRecords.map((rec) => {
            const m = rec.matched_with
            return (
              <div
                key={rec.id}
                className="flex items-start justify-between border-b border-[#1A1A1A]/8 py-4"
              >
                <div className="min-w-0">
                  <p className="font-inter text-sm font-medium text-[#1A1A1A]">
                    {m ? `${m.first_name} ${m.last_name}` : 'Match'}
                  </p>
                  <p className="mt-0.5 font-inter text-[11px] text-[#6C6863]">
                    {[m?.designation, m?.city].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {rec.sent_at && (
                    <p className="mt-1 font-inter text-[11px] uppercase tracking-[0.15em] text-[#6C6863]/70">
                      {formatNoteDate(rec.sent_at)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 pl-4">
                  <span className={`h-1.5 w-1.5 ${scoreDot(rec.match_score)}`} />
                  <span className="font-inter text-sm text-[#1A1A1A]">
                    {rec.match_score ?? '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
