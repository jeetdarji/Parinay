// Grouped profile-field container. Title + divider + two-column field rows.
export default function SectionBlock({ title, children }) {
  return (
    <div className="mb-8">
      <p className="font-inter text-[10px] font-medium uppercase tracking-[0.3em] text-[#6C6863]">
        {title}
      </p>
      <div className="mb-4 mt-2 h-px w-full bg-[#1A1A1A]/10" />
      <div className="flex flex-col gap-y-3">{children}</div>
    </div>
  )
}

/** A single label/value row. Renders an em-dash for empty values. */
export function Field({ label, value }) {
  const empty = value === null || value === undefined || value === '' ||
    (Array.isArray(value) && value.length === 0)
  return (
    <div className="flex items-start gap-4">
      <span className="w-2/5 shrink-0 font-inter text-[11px] font-medium uppercase tracking-[0.2em] text-[#6C6863]">
        {label}
      </span>
      <span className="w-3/5 font-inter text-sm leading-relaxed text-[#1A1A1A]">
        {empty ? <span className="text-[#6C6863]">—</span> : value}
      </span>
    </div>
  )
}
