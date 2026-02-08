import type { Championship } from '../db'

export type TimelineItem = Championship & { _isLoss?: boolean }

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Year the championship was actually played, derived from date when available */
export function champYear(c: Championship): number {
  if (c.championship_date) {
    return new Date(c.championship_date + 'T00:00:00').getFullYear()
  }
  return c.year
}
