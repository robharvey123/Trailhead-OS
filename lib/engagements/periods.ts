/**
 * Engagement billing months.
 *
 * A billing month runs from the engagement's `billing_month_start_day` (1 to 28,
 * default 1 = calendar month) to the day before that day in the following month,
 * e.g. 15 Aug to 14 Sep. Work dated before the engagement's `start_date` counts in
 * the billing month that contains `start_date`, so pre-start preparation lands in
 * month one rather than in a month the contract never covered.
 *
 * Pure date-string maths (YYYY-MM-DD, UTC arithmetic, no timezone drift). This
 * MUST stay in step with engagement_period_start() in Postgres
 * (migration 20260910100000_engagement_billing_months.sql), which buckets the
 * engagement_hours_by_month view the same way.
 */

export type BillingPeriodBasis = {
  start_date: string | null
  billing_month_start_day?: number | null
}

export type BillingPeriod = {
  /** First day of the billing month (inclusive). */
  start: string
  /** Last day of the billing month (inclusive). */
  end: string
  /** True for the engagement's first billing month, which also absorbs pre-start work. */
  isFirst: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Today's calendar date in Europe/London as YYYY-MM-DD. */
export function londonTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Clamp a start day into 1..28 so every month has that day. */
export function clampStartDay(day: number | null | undefined): number {
  const n = Math.trunc(Number(day ?? 1))
  if (!Number.isFinite(n) || n < 1) return 1
  return n > 28 ? 28 : n
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  // Only ever called with day <= 28, so the day never overflows.
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10)
}

/** Start of the anchored month containing `dateIso`, ignoring start_date. */
function anchoredStart(dateIso: string, startDay: number): string {
  const shifted = addDaysIso(dateIso, -(startDay - 1))
  return addDaysIso(`${shifted.slice(0, 7)}-01`, startDay - 1)
}

/** Start of the billing month an entry dated `dateIso` counts in (pre-start work folds forward). */
export function billingPeriodStartFor(dateIso: string, basis: BillingPeriodBasis): string {
  const day = clampStartDay(basis.billing_month_start_day)
  const d = dateIso.slice(0, 10)
  const effective = basis.start_date && d < basis.start_date ? basis.start_date : d
  return anchoredStart(effective, day)
}

/** The engagement's first billing month start. */
export function firstBillingPeriodStart(basis: BillingPeriodBasis): string | null {
  return basis.start_date ? anchoredStart(basis.start_date, clampStartDay(basis.billing_month_start_day)) : null
}

export function billingPeriodFromStart(start: string, basis: BillingPeriodBasis): BillingPeriod {
  return {
    start,
    end: addDaysIso(addMonthsIso(start, 1), -1),
    isFirst: firstBillingPeriodStart(basis) === start,
  }
}

export function billingPeriodFor(dateIso: string, basis: BillingPeriodBasis): BillingPeriod {
  return billingPeriodFromStart(billingPeriodStartFor(dateIso, basis), basis)
}

/** The billing month containing today (London). Before the start date this is month one. */
export function currentBillingPeriod(basis: BillingPeriodBasis, today = londonTodayIso()): BillingPeriod {
  return billingPeriodFor(today, basis)
}

/** The billing month before the current one (the default monthly report period). */
export function previousBillingPeriod(basis: BillingPeriodBasis, today = londonTodayIso()): BillingPeriod {
  const current = currentBillingPeriod(basis, today)
  return billingPeriodFor(addDaysIso(current.start, -1), basis)
}

/** Every billing month that overlaps [fromIso, toIso], in order. */
export function billingPeriodsTouching(fromIso: string, toIso: string, basis: BillingPeriodBasis): BillingPeriod[] {
  const out: BillingPeriod[] = []
  let cursor = billingPeriodStartFor(fromIso, basis)
  const last = billingPeriodStartFor(toIso, basis)
  while (cursor <= last) {
    out.push(billingPeriodFromStart(cursor, basis))
    cursor = addMonthsIso(cursor, 1)
  }
  return out
}

/**
 * Lower bound for an entry_date query over [fromIso, toIso]. Returns null (no lower
 * bound) when the range contains the engagement start date, so pre-start work is
 * included with the period it folds into.
 */
export function entryDateLowerBound(fromIso: string, toIso: string, basis: BillingPeriodBasis): string | null {
  const s = basis.start_date
  if (s && fromIso <= s && s <= toIso) return null
  return fromIso
}

/** "15 Aug to 14 Sep", or "15 Aug 2026 to 14 Sep 2026" with years. */
export function formatBillingPeriod(period: { start: string; end: string }, opts: { year?: boolean } = {}): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return `${d} ${MONTHS[m - 1]}${opts.year ? ` ${y}` : ''}`
  }
  return `${fmt(period.start)} to ${fmt(period.end)}`
}

/** Whole days from today to the period end, inclusive of today. */
export function daysLeftInPeriod(period: BillingPeriod, today = londonTodayIso()): number {
  const ms = Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000) + 1)
}
