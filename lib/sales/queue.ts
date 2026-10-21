import type { SupabaseClient } from '@supabase/supabase-js'
import { getCallEligibility, type CallEligibility } from '@/lib/outreach/call-eligibility'
import { getSalesScopePrefixes, tagsInScope } from '@/lib/sales/data'

/**
 * The daily call queue for the sales seat, and the pipeline/dashboard reads
 * that share its inputs. Works with the seat's own client (RLS scopes the rows)
 * and with the service role (the MCP tools), because the tag-prefix scope is
 * applied here as well.
 *
 * Every row passes the shared call-eligibility rule (CTPS clear within 28
 * days, not do_not_call / unsubscribed / bounced, has a phone). Nothing the
 * CTPS gate would exclude can appear, whatever its stage or callback.
 */

export const PIPELINE_STAGES = [
  'new', 'contacted', 'conversation', 'demo_booked', 'trial', 'customer', 'disqualified', 'lost',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  conversation: 'Conversation',
  demo_booked: 'Demo booked',
  trial: 'Trial',
  customer: 'Customer',
  disqualified: 'Disqualified',
  lost: 'Lost',
}

export const OUTCOME_CODES = ['NA', 'VM', 'GK', 'CB', 'CONV', 'DEMO', 'TRIAL', 'WON', 'DQ', 'LOST'] as const
export type OutcomeCode = (typeof OUTCOME_CODES)[number]

export const OUTCOME_LABELS: Record<OutcomeCode, string> = {
  NA: 'No answer',
  VM: 'Voicemail',
  GK: 'Gatekeeper',
  CB: 'Callback',
  CONV: 'Conversation',
  DEMO: 'Demo booked',
  TRIAL: 'Trial',
  WON: 'Won',
  DQ: 'Disqualified',
  LOST: 'Lost',
}

/** Outcomes that need a summary, a reason, or a date (mirrors log_sales_outcome). */
export const NEEDS_SUMMARY: ReadonlySet<OutcomeCode> = new Set(['CONV', 'DEMO', 'DQ', 'LOST'])
export const NEEDS_REASON: ReadonlySet<OutcomeCode> = new Set(['DQ', 'LOST'])
export const NEEDS_DATE: ReadonlySet<OutcomeCode> = new Set(['CB'])

export interface PipelineContact {
  id: string
  name: string
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  city: string | null
  sub_trade: string | null
  size_signal: string | null
  size_rank: number | null
  tags: string[]
  pipeline_stage: PipelineStage
  owner_user_id: string | null
  next_action_at: string | null
  next_action_note: string | null
  recontact_after: string | null
  lost_reason: string | null
  disqualified_reason: string | null
  engineer_os_org_id: string | null
}

export interface LastTouch {
  type: string
  subject: string
  body: string | null
  occurred_at: string
  outcome_code: OutcomeCode | null
}

export interface EmailStats {
  sent: number
  opened: number
  lastSentAt: string | null
}

export type QueueBucket = 'callback' | 'warm' | 'trial' | 'cold'

export const BUCKET_LABELS: Record<QueueBucket, string> = {
  callback: 'Callbacks due',
  warm: 'Conversations and demos going cold',
  trial: 'Trials to check in on',
  cold: 'New and contacted',
}

export interface QueueRow extends PipelineContact {
  bucket: QueueBucket
  eligibility: CallEligibility
  lastTouch: LastTouch | null
  email: string | null
  emailStats: EmailStats
}

const CONTACT_COLUMNS =
  'id, name, company, role, phone, email, city, sub_trade, size_signal, size_rank, tags, pipeline_stage, owner_user_id, next_action_at, next_action_note, recontact_after, lost_reason, disqualified_reason, engineer_os_org_id'

const DAY = 24 * 60 * 60 * 1000

/** End of "today" in Europe/London, as an absolute instant. */
export function endOfLondonDay(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const londonAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  const offsetMs = londonAsUtc - Math.floor(now.getTime() / 1000) * 1000
  const londonMidnightNext = Date.UTC(get('year'), get('month') - 1, get('day') + 1, 0, 0, 0)
  return new Date(londonMidnightNext - offsetMs - 1)
}

/** Monday 00:00 Europe/London of the week containing `now`, as an instant. */
export function startOfLondonWeek(now: Date = new Date()): Date {
  const endToday = endOfLondonDay(now)
  const startToday = new Date(endToday.getTime() + 1 - DAY)
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(now)
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekday)
  return new Date(startToday.getTime() - Math.max(idx, 0) * DAY)
}

/** In-scope, unmerged contacts with their pipeline fields. */
export async function listPipelineContacts(supabase: SupabaseClient): Promise<PipelineContact[]> {
  const [prefixes, { data, error }] = await Promise.all([
    getSalesScopePrefixes(supabase),
    supabase.from('contacts').select(CONTACT_COLUMNS).is('merged_into', null),
  ])
  if (error) throw new Error(error.message)
  return ((data ?? []) as PipelineContact[]).filter((c) => tagsInScope(c.tags, prefixes))
}

const CHUNK = 200
function chunks<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK))
  return out
}

export async function getLastTouches(supabase: SupabaseClient, contactIds: readonly string[]): Promise<Map<string, LastTouch>> {
  const out = new Map<string, LastTouch>()
  for (const ids of chunks(contactIds)) {
    const { data } = await supabase
      .from('touchpoints')
      .select('contact_id, type, subject, body, occurred_at, outcome_code')
      .in('contact_id', ids)
      .order('occurred_at', { ascending: false })
      .limit(5000)
    for (const t of (data ?? []) as Array<LastTouch & { contact_id: string }>) {
      if (!out.has(t.contact_id)) out.set(t.contact_id, t)
    }
  }
  return out
}

export async function getEmailStats(supabase: SupabaseClient, contactIds: readonly string[]): Promise<Map<string, EmailStats>> {
  const out = new Map<string, EmailStats>()
  for (const ids of chunks(contactIds)) {
    const { data } = await supabase
      .from('outreach_recipients')
      .select('contact_id, sends:outreach_sends(status, sent_at, first_opened_at)')
      .in('contact_id', ids)
    for (const r of (data ?? []) as Array<{ contact_id: string; sends: Array<{ status: string; sent_at: string | null; first_opened_at: string | null }> }>) {
      const s = out.get(r.contact_id) ?? { sent: 0, opened: 0, lastSentAt: null }
      for (const send of r.sends ?? []) {
        if (send.sent_at) {
          s.sent++
          if (!s.lastSentAt || send.sent_at > s.lastSentAt) s.lastSentAt = send.sent_at
        }
        if (send.first_opened_at) s.opened++
      }
      out.set(r.contact_id, s)
    }
  }
  return out
}

/**
 * The queue, in order:
 *   1. callbacks due today or overdue, oldest first
 *   2. conversation / demo_booked with no touchpoint in 5 days
 *   3. trial with no touchpoint in 3 days
 *   4. new / contacted, opened-an-email first, then size_rank desc, then most
 *      recent campaign email first
 * Contacts owned by another user are left out when `forUserId` is given.
 */
export async function getSalesQueue(
  supabase: SupabaseClient,
  opts: { forUserId?: string | null; now?: Date } = {},
): Promise<QueueRow[]> {
  const now = opts.now ?? new Date()
  const endToday = endOfLondonDay(now).getTime()
  const contacts = (await listPipelineContacts(supabase)).filter(
    (c) => !opts.forUserId || !c.owner_user_id || c.owner_user_id === opts.forUserId,
  )
  const ids = contacts.map((c) => c.id)
  const [eligibility, lastTouches, emailStats] = await Promise.all([
    getCallEligibility(supabase, ids),
    getLastTouches(supabase, ids),
    getEmailStats(supabase, ids),
  ])

  const touchedWithin = (id: string, days: number) => {
    const t = lastTouches.get(id)
    return Boolean(t && now.getTime() - new Date(t.occurred_at).getTime() < days * DAY)
  }

  const rows: QueueRow[] = []
  for (const c of contacts) {
    const e = eligibility.get(c.id)
    if (!e?.eligible) continue // the CTPS gate always wins
    let bucket: QueueBucket | null = null
    if (c.next_action_at && new Date(c.next_action_at).getTime() <= endToday && !['customer', 'disqualified', 'lost'].includes(c.pipeline_stage)) {
      bucket = 'callback'
    } else if ((c.pipeline_stage === 'conversation' || c.pipeline_stage === 'demo_booked') && !touchedWithin(c.id, 5)) {
      bucket = 'warm'
    } else if (c.pipeline_stage === 'trial' && !touchedWithin(c.id, 3)) {
      bucket = 'trial'
    } else if ((c.pipeline_stage === 'new' || c.pipeline_stage === 'contacted') && !c.next_action_at) {
      bucket = 'cold'
    }
    if (!bucket) continue
    rows.push({
      ...c,
      bucket,
      eligibility: e,
      lastTouch: lastTouches.get(c.id) ?? null,
      emailStats: emailStats.get(c.id) ?? { sent: 0, opened: 0, lastSentAt: null },
    })
  }

  const order: Record<QueueBucket, number> = { callback: 0, warm: 1, trial: 2, cold: 3 }
  const time = (v: string | null | undefined) => (v ? new Date(v).getTime() : 0)
  rows.sort((a, b) => {
    if (a.bucket !== b.bucket) return order[a.bucket] - order[b.bucket]
    if (a.bucket === 'callback') return time(a.next_action_at) - time(b.next_action_at)
    if (a.bucket === 'warm' || a.bucket === 'trial') return time(a.lastTouch?.occurred_at) - time(b.lastTouch?.occurred_at)
    const opened = Number(b.emailStats.opened > 0) - Number(a.emailStats.opened > 0)
    if (opened) return opened
    const size = (b.size_rank ?? 0) - (a.size_rank ?? 0)
    if (size) return size
    return time(b.emailStats.lastSentAt) - time(a.emailStats.lastSentAt)
  })
  return rows
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface WeekStats {
  dials: number
  conversations: number
  demosBooked: number
  demosRun: number
  trials: number
  won: number
  lost: number
}

export interface SalesDashboardData {
  thisWeek: WeekStats
  lastWeek: WeekStats
  weekStartsAt: string
  funnel: Array<{ stage: PipelineStage; count: number }>
  listHealth: { newRemaining: number; ctpsClear: number; screenedOver21Days: number; needsScreening: number }
}

function emptyWeek(): WeekStats {
  return { dials: 0, conversations: 0, demosBooked: 0, demosRun: 0, trials: 0, won: 0, lost: 0 }
}

export async function getSalesDashboard(supabase: SupabaseClient, now: Date = new Date()): Promise<SalesDashboardData> {
  const weekStart = startOfLondonWeek(now)
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY)
  const contacts = await listPipelineContacts(supabase)
  const ids = contacts.map((c) => c.id)

  const touches: Array<{ contact_id: string; type: string; outcome_code: OutcomeCode | null; occurred_at: string }> = []
  for (const part of chunks(ids)) {
    const { data } = await supabase
      .from('touchpoints')
      .select('contact_id, type, outcome_code, occurred_at')
      .in('contact_id', part)
      .not('outcome_code', 'is', null)
      .gte('occurred_at', lastWeekStart.toISOString())
      .limit(10000)
    touches.push(...((data ?? []) as typeof touches))
  }

  const thisWeek = emptyWeek()
  const lastWeek = emptyWeek()
  for (const t of touches) {
    const w = new Date(t.occurred_at) >= weekStart ? thisWeek : lastWeek
    const code = t.outcome_code
    if (t.type === 'call') w.dials++
    if (code === 'CONV' || code === 'DEMO' || code === 'TRIAL' || code === 'WON') w.conversations++
    if (code === 'DEMO' && t.type !== 'demo') w.demosBooked++
    if (code === 'DEMO' && t.type === 'demo') w.demosRun++
    if (code === 'TRIAL') w.trials++
    if (code === 'WON') w.won++
    if (code === 'LOST') w.lost++
  }

  const eligibility = await getCallEligibility(supabase, ids)
  const cutoff21 = now.getTime() - 21 * DAY
  const funnel = PIPELINE_STAGES.map((stage) => ({ stage, count: contacts.filter((c) => c.pipeline_stage === stage).length }))
  let ctpsClear = 0
  let screenedOver21Days = 0
  let needsScreening = 0
  for (const id of ids) {
    const e = eligibility.get(id)
    if (!e) continue
    if (e.eligible) ctpsClear++
    if (e.reason === 'unscreened' || e.reason === 'ctps_stale') needsScreening++
    if (e.ctps_checked_at && new Date(e.ctps_checked_at).getTime() < cutoff21) screenedOver21Days++
  }

  return {
    thisWeek,
    lastWeek,
    weekStartsAt: weekStart.toISOString(),
    funnel,
    listHealth: {
      newRemaining: contacts.filter((c) => c.pipeline_stage === 'new').length,
      ctpsClear,
      screenedOver21Days,
      needsScreening,
    },
  }
}
