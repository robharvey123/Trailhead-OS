import { createClient } from '@/lib/supabase/server'
import type {
  EngagementInput,
  EngagementStatus,
  EngagementWithRelations,
  Tier1MilestoneSummary,
  Tier1MilestoneWithAccount,
} from '@/lib/types'
import {
  billingPeriodStartFor,
  currentBillingPeriod,
  type BillingPeriod,
  type BillingPeriodBasis,
} from '@/lib/engagements/periods'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const ENGAGEMENT_SELECT =
  '*, notice_date, end_client:accounts!end_client_account_id(id,name), billed_via:accounts!billed_via_account_id(id,name)'

// Terminal engagement statuses — excluded by `excludeTerminal`. Case-insensitive
// variants included so this survives any future casing/value additions.
const TERMINAL_ENGAGEMENT_STATUSES =
  '("Completed","completed","Terminated","terminated","Cancelled","cancelled","Archived","archived")'

export async function listEngagements(
  filters: { status?: EngagementStatus; accountId?: string; excludeTerminal?: boolean } = {},
  client?: SupabaseClient
): Promise<EngagementWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('engagements').select(ENGAGEMENT_SELECT).order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  // Prefer this over status='Active' for pickers: keeps Paused/Draft/future
  // in-progress statuses selectable, only dropping terminal ones.
  if (filters.excludeTerminal) query = query.not('status', 'in', TERMINAL_ENGAGEMENT_STATUSES)
  if (filters.accountId) query = query.eq('end_client_account_id', filters.accountId)
  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load engagements')
  return (data ?? []) as unknown as EngagementWithRelations[]
}

export type EngagementHoursUsage = {
  used: number
  included: number | null
  over: number
  pct: number
  /** The billing month these figures cover (anchored on billing_month_start_day). */
  period: BillingPeriod
}

type HoursEngagementRef = BillingPeriodBasis & { id: string; included_hours_monthly: number | null }

/**
 * Hours used in the engagement's CURRENT billing month (billing_month_start_day
 * anchored, no carry-forward). In month one, work dated before start_date is
 * included, matching engagement_hours_by_month.
 */
export async function engagementHoursThisMonth(
  engagement: HoursEngagementRef,
  client?: SupabaseClient
): Promise<EngagementHoursUsage> {
  const supabase = await getSupabase(client)
  const period = currentBillingPeriod(engagement)
  let query = supabase
    .from('time_entries')
    .select('duration_minutes')
    .eq('engagement_id', engagement.id)
    .eq('is_running', false)
    .lte('entry_date', period.end)
  if (!period.isFirst) query = query.gte('entry_date', period.start)
  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load engagement hours')
  const minutes = (data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const used = minutes / 60
  const includedHours = engagement.included_hours_monthly
  const over = includedHours != null ? used - includedHours : 0
  const pct = includedHours && includedHours > 0 ? Math.round((used / includedHours) * 100) : 0
  return { used, included: includedHours, over, pct, period }
}

export type PeriodHoursRow = { used: number; billable: number; over: number; period: BillingPeriod }

/**
 * Current-billing-month hours for many engagements in one query against
 * engagement_hours_by_month. Each engagement can have its own start day, so rows
 * are matched on (engagement_id, period_month) rather than one shared month key.
 */
export async function currentPeriodHoursByEngagement(
  engagements: Array<HoursEngagementRef>,
  client?: SupabaseClient
): Promise<Map<string, PeriodHoursRow>> {
  const out = new Map<string, PeriodHoursRow>()
  if (engagements.length === 0) return out
  const supabase = await getSupabase(client)
  const periods = new Map(engagements.map((e) => [e.id, currentBillingPeriod(e)]))
  const starts = [...new Set([...periods.values()].map((p) => p.start))]
  const { data } = await supabase
    .from('engagement_hours_by_month')
    .select('engagement_id, period_month, hours_used, billable_hours, hours_over')
    .in('engagement_id', engagements.map((e) => e.id))
    .in('period_month', starts)
  const rows = (data ?? []) as Array<{
    engagement_id: string
    period_month: string
    hours_used: number | string | null
    billable_hours: number | string | null
    hours_over: number | string | null
  }>
  for (const e of engagements) {
    const period = periods.get(e.id)!
    const row = rows.find((r) => r.engagement_id === e.id && r.period_month === period.start)
    const used = Number(row?.hours_used ?? 0)
    out.set(e.id, {
      used,
      billable: Number(row?.billable_hours ?? 0),
      over: row?.hours_over != null ? Number(row.hours_over) : used - (e.included_hours_monthly ?? 0),
      period,
    })
  }
  return out
}

/** Hours for the billing month containing `dateIso` (used by the MCP month lookup). */
export async function periodHoursFor(
  engagement: HoursEngagementRef,
  dateIso: string,
  client?: SupabaseClient
): Promise<{ used: number; billable: number; period_start: string }> {
  const supabase = await getSupabase(client)
  const periodStart = billingPeriodStartFor(dateIso, engagement)
  const { data } = await supabase
    .from('engagement_hours_by_month')
    .select('hours_used, billable_hours')
    .eq('engagement_id', engagement.id)
    .eq('period_month', periodStart)
    .maybeSingle()
  const row = data as { hours_used?: number | string; billable_hours?: number | string } | null
  return { used: Number(row?.hours_used ?? 0), billable: Number(row?.billable_hours ?? 0), period_start: periodStart }
}

export interface EngagementDetail {
  engagement: EngagementWithRelations
  tier1: Tier1MilestoneWithAccount[]
  hoursThisMonth: EngagementHoursUsage
  milestoneSummary: Tier1MilestoneSummary | null
}

export async function getEngagement(id: string, client?: SupabaseClient): Promise<EngagementDetail | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('engagements').select(ENGAGEMENT_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load engagement')
  if (!data) return null
  const engagement = data as unknown as EngagementWithRelations

  const [tier1Res, hoursThisMonth, summaryRes] = await Promise.all([
    supabase
      .from('tier1_milestones')
      .select('*, account:accounts(id,name,channel)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: true }),
    engagementHoursThisMonth(engagement, supabase),
    supabase.from('tier1_milestone_summary').select('*').eq('engagement_id', id).maybeSingle(),
  ])

  return {
    engagement,
    tier1: (tier1Res.data ?? []) as unknown as Tier1MilestoneWithAccount[],
    hoursThisMonth,
    milestoneSummary: (summaryRes.data as Tier1MilestoneSummary | null) ?? null,
  }
}

export async function upsertEngagement(input: EngagementInput, client?: SupabaseClient): Promise<EngagementWithRelations> {
  const supabase = await getSupabase(client)
  const patch: Record<string, unknown> = {}
  const fields: (keyof EngagementInput)[] = [
    'end_client_account_id', 'billed_via_account_id', 'engagement_type', 'name', 'code', 'status', 'currency',
    'retainer_amount_monthly', 'included_hours_monthly', 'day_rate', 'performance_fee_default',
    'start_date', 'end_date', 'notice_period_days', 'auto_renews', 'renewal_term_months', 'billing_month_start_day',
    'approval_thresholds', 'notes',
  ]
  for (const f of fields) if (f in input) patch[f] = (input as unknown as Record<string, unknown>)[f]

  if (input.id) {
    const { data, error } = await supabase.from('engagements').update(patch).eq('id', input.id).select(ENGAGEMENT_SELECT).single()
    if (error) throw new Error(error.message || 'Failed to update engagement')
    return data as unknown as EngagementWithRelations
  }
  const { data, error } = await supabase.from('engagements').insert(patch).select(ENGAGEMENT_SELECT).single()
  if (error) throw new Error(error.message || 'Failed to create engagement')
  return data as unknown as EngagementWithRelations
}

async function setStatus(id: string, status: EngagementStatus, endDate?: string, client?: SupabaseClient) {
  const supabase = await getSupabase(client)
  const patch: Record<string, unknown> = { status }
  if (endDate) patch.end_date = endDate
  const { error } = await supabase.from('engagements').update(patch).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to update engagement status')
}

export const pauseEngagement = (id: string, c?: SupabaseClient) => setStatus(id, 'Paused', undefined, c)
export const resumeEngagement = (id: string, c?: SupabaseClient) => setStatus(id, 'Active', undefined, c)
export const terminateEngagement = (id: string, endDate: string, c?: SupabaseClient) =>
  setStatus(id, 'Terminated', endDate, c)

export interface EngagementLinkCounts {
  projects: number // unlinked (engagement_id set null) — records kept
  timeEntries: number // unlinked (engagement_id set null) — records kept
  milestones: number // cascade-deleted — engagement_id is NOT NULL, cannot be unlinked
  approvals: number // cascade-deleted
  documents: number // cascade-deleted
  touchpoints: number // unlinked (engagement_id set null) — records kept
}

/** Non-null account ids attached to an engagement (end client + billed via). */
export function engagementAccountIds(detail: EngagementDetail): string[] {
  const e = detail.engagement
  return [e.end_client_account_id, e.billed_via_account_id].filter((x): x is string => Boolean(x))
}

/** Counts of records linked to an engagement, for the delete-confirmation UI. */
export async function engagementLinkCounts(id: string, client?: SupabaseClient): Promise<EngagementLinkCounts> {
  const supabase = await getSupabase(client)
  const head = async (table: string) => {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('engagement_id', id)
    return count ?? 0
  }
  const [projects, timeEntries, milestones, approvals, documents, touchpoints] = await Promise.all([
    head('projects'),
    head('time_entries'),
    head('tier1_milestones'),
    head('approval_requests'),
    head('engagement_documents'),
    head('touchpoints'),
  ])
  return { projects, timeEntries, milestones, approvals, documents, touchpoints }
}

/**
 * Hard-deletes an engagement. The FK rules do the cleanup:
 *   • projects / time_entries → engagement_id set to NULL (records kept, just unlinked)
 *   • tier1_milestones, engagement_tier1_accounts, approval_requests,
 *     engagement_documents → cascade-deleted (these cannot exist without the engagement)
 * To keep all data instead, terminate the engagement rather than deleting it.
 */
export async function deleteEngagement(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('engagements').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete engagement')
}

export async function addTier1Account(
  engagementId: string,
  accountId: string,
  performanceFee: number | null,
  notes?: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const auth = await supabase.auth.getUser()
  const { error: linkErr } = await supabase
    .from('engagement_tier1_accounts')
    .upsert({ engagement_id: engagementId, account_id: accountId, notes: notes ?? null, added_by: auth.data.user?.id ?? null }, { onConflict: 'engagement_id,account_id' })
  if (linkErr) throw new Error(linkErr.message || 'Failed to add tier-1 account')
  // Auto-create the milestone row (idempotent on the unique constraint).
  const { error: msErr } = await supabase
    .from('tier1_milestones')
    .upsert({ engagement_id: engagementId, account_id: accountId, performance_fee: performanceFee }, { onConflict: 'engagement_id,account_id', ignoreDuplicates: true })
  if (msErr) throw new Error(msErr.message || 'Failed to create milestone')
}

export async function removeTier1Account(engagementId: string, accountId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  await supabase.from('engagement_tier1_accounts').delete().eq('engagement_id', engagementId).eq('account_id', accountId)
  await supabase.from('tier1_milestones').delete().eq('engagement_id', engagementId).eq('account_id', accountId)
}

export async function setProjectEngagement(projectId: string, engagementId: string | null, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('projects').update({ engagement_id: engagementId }).eq('id', projectId)
  if (error) throw new Error(error.message || 'Failed to link project')
}

