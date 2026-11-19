import { formatMoney } from '@/lib/money'

/** Customer-facing formatting for the proposal page, PDF and emails. GBP only. */

export function gbp(value: number): string {
  return formatMoney(value, 'GBP')
}

function parseDate(value: string): Date {
  // A bare YYYY-MM-DD is a calendar date: pin it to midday UTC so no timezone
  // shift can move it to the neighbouring day.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value)
}

/** "19 November 2026" in Europe/London. */
export function longDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(parseDate(value))
}

/** "19 Nov 2026" in Europe/London. */
export function shortDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(parseDate(value))
}

/** Split client notes or terms into list lines, dropping blanks and leading bullets. */
export function noteLines(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean)
}
