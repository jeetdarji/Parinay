// Pure check-in alert engine. No React, no Supabase.
// Categorizes clients by how overdue their bi-weekly touchpoint is.

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysSince(dateString) {
  if (!dateString) return null
  const t = new Date(dateString).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / MS_PER_DAY)
}

/**
 * computeAlerts(clients) → { overdue, dueSoon, needsFeedback, newWithoutMatch }
 * Each array holds full client objects. A client may appear in multiple lists.
 */
export function computeAlerts(clients = []) {
  const overdue = []
  const dueSoon = []
  const needsFeedback = []
  const newWithoutMatch = []

  for (const c of clients) {
    if (!c) continue
    const sinceContact = daysSince(c.last_contacted_at)
    const sinceCreated = daysSince(c.created_at)

    // Null last_contacted_at → treat as overdue unless brand new (<2 days old).
    let isOverdue
    let isDueSoon = false
    if (sinceContact === null) {
      isOverdue = sinceCreated === null ? false : sinceCreated > 2
    } else {
      isOverdue = sinceContact >= 14
      isDueSoon = !isOverdue && sinceContact >= 7
    }

    if (isOverdue) overdue.push(c)
    if (isDueSoon) dueSoon.push(c)

    if (
      c.stage === 'Date Completed' &&
      sinceContact !== null &&
      sinceContact >= 3
    ) {
      needsFeedback.push(c)
    }

    if (
      c.stage === 'Profile Verified' &&
      sinceCreated !== null &&
      sinceCreated > 7
    ) {
      newWithoutMatch.push(c)
    }
  }

  return { overdue, dueSoon, needsFeedback, newWithoutMatch }
}

/**
 * Most-severe alert level for a single client, or null.
 * Severity: overdue > dueSoon > needsFeedback.
 * Returns 'overdue' | 'dueSoon' | 'needsFeedback' | null.
 */
export function clientAlertLevel({ lastContactedAt, stage, createdAt }) {
  const { overdue, dueSoon, needsFeedback } = computeAlerts([
    { last_contacted_at: lastContactedAt, stage, created_at: createdAt },
  ])
  if (overdue.length) return 'overdue'
  if (dueSoon.length) return 'dueSoon'
  if (needsFeedback.length) return 'needsFeedback'
  return null
}
