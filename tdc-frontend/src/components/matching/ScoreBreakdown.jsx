import { AnimatePresence, motion } from 'framer-motion'

// Display names + per-axis max scores for the mini bars.
const AXES = [
  { key: 'kids', label: 'Family Plans', max: 25 },
  { key: 'relocation', label: 'Relocation', max: 20 },
  { key: 'lifestyle', label: 'Lifestyle', max: 15 },
  { key: 'education', label: 'Education', max: 15 },
  { key: 'geography', label: 'Geography', max: 15 },
  { key: 'religion_caste', label: 'Religion & Caste', max: 10 },
  { key: 'age_delta', label: 'Age Compatibility', max: 5 },
  { key: 'interest_similarity', label: 'Shared Interests', max: 1.0 },
]

const BAR_WIDTH = 64 // px

export default function ScoreBreakdown({ breakdown, isOpen }) {
  if (!breakdown) return null

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-hidden"
        >
          <div className="mt-3 border-t border-[#1A1A1A]/8 bg-[#EBE5DE]/40 pt-3">
            {AXES.map((axis) => {
              const raw = breakdown[axis.key] ?? 0
              const isFloat = axis.key === 'interest_similarity'
              const ratio = Math.max(0, Math.min(1, raw / axis.max))
              const fillPx = Math.round(ratio * BAR_WIDTH)
              const display = isFloat
                ? Number(raw).toFixed(2)
                : `${raw} / ${axis.max}`
              return (
                <div
                  key={axis.key}
                  className="flex items-center justify-between py-1.5"
                >
                  <span className="font-inter text-[10px] uppercase tracking-[0.2em] text-[#6C6863]">
                    {axis.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className="relative h-1 bg-[#1A1A1A]/8"
                      style={{ width: `${BAR_WIDTH}px` }}
                    >
                      <span
                        className="absolute left-0 top-0 h-1 bg-[#1A1A1A]/40"
                        style={{ width: `${fillPx}px` }}
                      />
                    </span>
                    <span className="w-12 text-right font-inter text-[10px] text-[#6C6863]">
                      {display}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
