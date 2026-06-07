// Pure display formatters. No React, no data fetching.

const MS_PER_DAY = 1000 * 60 * 60 * 24
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "Today" / "3 days ago" / "1 week ago" / "2 months ago". */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'Never'
  const then = new Date(dateString)
  if (Number.isNaN(then.getTime())) return '—'
  const days = Math.floor((Date.now() - then.getTime()) / MS_PER_DAY)

  if (days <= 0) return 'Today'
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 14) return '1 week ago'
  if (days < 21) return '2 weeks ago'
  if (days < 28) return '3 weeks ago'
  const months = Math.floor(days / 30)
  return `${Math.max(1, months)} month${months <= 1 ? '' : 's'} ago`
}

/** Indian-format compact income: ₹85K / ₹24L / ₹1.2Cr. */
export function formatIncome(inrAmount) {
  if (inrAmount === null || inrAmount === undefined || inrAmount === '') return '—'
  const n = Number(inrAmount)
  if (Number.isNaN(n)) return '—'

  if (n < 100000) {
    const k = n / 1000
    return `₹${Number.isInteger(k) ? k : k.toFixed(1)}K`
  }
  if (n < 10000000) {
    const l = n / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  const cr = n / 10000000
  return `₹${Number.isInteger(cr) ? cr : cr.toFixed(1)}Cr`
}

/** "06 JUN 2026 · 14:32". */
export function formatNoteDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTHS[d.getMonth()]
  const year = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${year} · ${hh}:${mm}`
}

/** "175 cm · 5'9"". */
export function formatHeightCm(cm) {
  if (cm === null || cm === undefined || cm === '') return '—'
  const n = Number(cm)
  if (Number.isNaN(n)) return '—'
  const feet = Math.floor(n / 30.48)
  const inches = Math.round((n % 30.48) / 2.54)
  // Handle rounding to 12 inches.
  const f = inches === 12 ? feet + 1 : feet
  const i = inches === 12 ? 0 : inches
  return `${n} cm · ${f}'${i}"`
}

/** "MONDAY / 07 JUNE 2026" for the dashboard header. */
export function formatHeaderDate(date = new Date()) {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const year = date.getFullYear()
  return `${weekday} / ${day} ${month} ${year}`
}

/** Square initials from first + last name. */
export function getInitials(firstName = '', lastName = '') {
  const a = (firstName || '').trim()[0] || ''
  const b = (lastName || '').trim()[0] || ''
  return (a + b).toUpperCase() || '—'
}
