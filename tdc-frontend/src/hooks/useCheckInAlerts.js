// Pure computed hook — derives alert categories from the clients array.
import { useMemo } from 'react'
import { computeAlerts } from '../utils/alertComputer'

export function useCheckInAlerts(clients = []) {
  return useMemo(() => {
    const { overdue, dueSoon, needsFeedback, newWithoutMatch } =
      computeAlerts(clients)
    return {
      overdue,
      dueSoon,
      needsFeedback,
      newWithoutMatch,
      totalAlerts:
        overdue.length +
        dueSoon.length +
        needsFeedback.length +
        newWithoutMatch.length,
    }
  }, [clients])
}
