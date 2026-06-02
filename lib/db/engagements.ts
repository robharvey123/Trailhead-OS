import { createClient } from '@/lib/supabase/server'
import type {
  EngagementInput,
  EngagementStatus,
  EngagementWithRelations,
  Tier1MilestoneSummary,
  Tier1MilestoneWithAccount,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const ENGAGEMENT_SELECT =
  '*, end_client:accounts!end_client_account_id(id,name), billed_via:accounts!billed_via_account_id(id,name)'

function monthBounds(d = new Date()) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const iso = (x: Date) => x.toISOString().split('T')[0]
  return { from: iso(from), to: iso(to) }
}

export async function listEngagements(
  filters: { status?: EngagementStatus; accountId?: string } = {},
  client?: SupabaseClient
): Promise<EngagementWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('engagements').select(ENGAGEMENT_SELECT).order('created_at', { ascending: false })
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.accountId) query = query.eq('end_client_account_id', filters.accountId)
  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load engagements')
  return (data ?? []) as unknown as EngagementWithRelations[]
}

/** Current-month hours used for an engagement (calendar-month aligned, no carry-forward). */
export async function engagementHoursThisMonth(
  engagementId: string,
  includedHours: number | null,
  client?: SupabaseClient
): Promise<{ used: number; included: number | null; over: number; pct: number }> {
  const supabase = await getSupabase(client)
  const { from, to } = monthBounds()
  const { data, error } = await supabase
    .from('time_entries')
    .select('duration_minutes')
    .eq('engagement_id', engagementId)
    .eq('is_running', false)
    .gte('entry_date', from)
    .lte('entry_date', to)
  if (error) throw new Error(error.message || 'Failed to load engagement hours')
  const minutes = (data ?? []).reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
  const used = minutes / 60
  const over = includedHours != null ? used - includedHours : 0
  const pct = includedHours && includedHours > 0 ? Math.round((used / includedHours) * 100) : 0
  return { used, included: includedHours, over, pct }
}

export interface EngagementDetail {
  engagement: EngagementWithRelations
  tier1: Tier1MilestoneWithAccount[]
  hoursThisMonth: { used: number; included: number | null; over: number; pct: number }
  workstreamSplit: Array<{ workstream: string; hours: number }>
  milestoneSummary: Tier1MilestoneSummary | null
}

export async function getEngagement(id: string, client?: SupabaseClient): Promise<EngagementDetail | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('engagements').select(ENGAGEMENT_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load engagement')
  if (!data) return null
  const engagement = data as unknown as EngagementWithRelations

  const { from, to } = monthBounds()
  const [tier1Res, hoursThisMonth, splitRes, summaryRes] = await Promise.all([
    supabase
      .from('tier1_milestones')
      .select('*, account:accounts(id,name,channel)')
      .eq('engagement_id', id)
      .order('created_at', { ascending: true }),
    engagementHoursThisMonth(id, engagement.included_hours_monthly, supabase),
    supabase
      .from('time_entries')
      .select('workstream, duration_minutes')
      .eq('engagement_id', id)
      .eq('is_running', false)
      .gte('entry_date', from)
      .lte('entry_date', to),
    supabase.from('tier1_milestone_summary').select('*').eq('engagement_id', id).maybeSingle(),
  ])

  const splitMap = new Map<string, number>()
  for (const r of (splitRes.data ?? []) as Array<{ workstream: string | null; duration_minutes: number }>) {
    const ws = r.workstream || 'Unspecified'
    splitMap.set(ws, (splitMap.get(ws) ?? 0) + (r.duration_minutes ?? 0) / 60)
  }

  return {
    engagement,
    tier1: (tier1Res.data ?? []) as unknown as Tier1MilestoneWithAccount[],
    hoursThisMonth,
    workstreamSplit: Array.from(splitMap.entries()).map(([workstream, hours]) => ({ workstream, hours })),
    milestoneSummary: (summaryRes.data as Tier1MilestoneSummary | null) ?? null,
  }
}

export async function upsertEngagement(input: EngagementInput, client?: SupabaseClient): Promise<EngagementWithRelations> {
  const supabase = await getSupabase(client)
  const patch: Record<string, unknown> = {}
  const fields: (keyof EngagementInput)[] = [
    'end_client_account_id', 'billed_via_account_id', 'name', 'code', 'status', 'currency',
    'retainer_amount_monthly', 'included_hours_monthly', 'day_rate', 'performance_fee_default',
    'start_date', 'end_date', 'workstreams', 'approval_thresholds', 'notes',
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

export interface WeeklyUpdateData {
  engagement: EngagementWithRelations
  weekStart: string
  weekEnd: string
  hoursWeek: number
  hoursMonth: number
  cap: number | null
  pctOfCap: number
  workstreamSplit: Array<{ workstream: string; hours: number }>
  pipeline: Array<{ stage: string; deals: Array<{ name: string; account: string }> }>
  milestonesTouched: Array<{ account: string; condition: string; date: string }>
  tasks: Array<{ title: string; due: string | null }>
}

/** Everything needed to populate the Annex A 3.4 weekly client update. */
export async function weeklyClientUpdateData(
  engagementId: string,
  weekStart: string,
  client?: SupabaseClient
): Promise<WeeklyUpdateData> {
  const supabase = await getSupabase(client)
  const start = new Date(weekStart)
  const endDate = new Date(start)
  endDate.setDate(start.getDate() + 6)
  const weekEnd = endDate.toISOString().split('T')[0]

  const { data: engRow } = await supabase.from('engagements').select(ENGAGEMENT_SELECT).eq('id', engagementId).maybeSingle()
  const engagement = engRow as unknown as EngagementWithRelations

  const [weekEntries, monthHours, tier1Res] = await Promise.all([
    supabase.from('time_entries').select('workstream, duration_minutes').eq('engagement_id', engagementId).eq('is_running', false).gte('entry_date', weekStart).lte('entry_date', weekEnd),
    engagementHoursThisMonth(engagementId, engagement?.included_hours_monthly ?? null, supabase),
    supabase.from('tier1_milestones').select('account_id, range_review_decided_at, go_live_confirmed_at, first_po_received_at, account:accounts(name)').eq('engagement_id', engagementId),
  ])

  let weekMinutes = 0
  const wsMap = new Map<string, number>()
  for (const r of (weekEntries.data ?? []) as Array<{ workstream: string | null; duration_minutes: number }>) {
    weekMinutes += r.duration_minutes ?? 0
    const ws = r.workstream || 'Unspecified'
    wsMap.set(ws, (wsMap.get(ws) ?? 0) + (r.duration_minutes ?? 0) / 60)
  }

  const milestones = (tier1Res.data ?? []) as unknown as Array<{
    account_id: string
    range_review_decided_at: string | null
    go_live_confirmed_at: string | null
    first_po_received_at: string | null
    account?: { name: string } | null
  }>
  const tier1AccountIds = milestones.map((m) => m.account_id)

  const milestonesTouched: WeeklyUpdateData['milestonesTouched'] = []
  const inWeek = (d: string | null) => d && d >= weekStart && d <= weekEnd
  for (const m of milestones) {
    if (inWeek(m.range_review_decided_at)) milestonesTouched.push({ account: m.account?.name ?? '—', condition: 'Range review decided', date: m.range_review_decided_at! })
    if (inWeek(m.go_live_confirmed_at)) milestonesTouched.push({ account: m.account?.name ?? '—', condition: 'Go-live confirmed', date: m.go_live_confirmed_at! })
    if (inWeek(m.first_po_received_at)) milestonesTouched.push({ account: m.account?.name ?? '—', condition: 'First PO received', date: m.first_po_received_at! })
  }

  // Pipeline: deals on the tier-1 accounts, grouped by stage.
  let pipeline: WeeklyUpdateData['pipeline'] = []
  if (tier1AccountIds.length) {
    const { data: deals } = await supabase.from('deals').select('name, stage, account:accounts(name)').in('account_id', tier1AccountIds).not('stage', 'in', '("Won","Lost")')
    const byStage = new Map<string, Array<{ name: string; account: string }>>()
    for (const d of (deals ?? []) as unknown as Array<{ name: string; stage: string; account?: { name: string } | null }>) {
      const list = byStage.get(d.stage) ?? byStage.set(d.stage, []).get(d.stage)!
      list.push({ name: d.name, account: d.account?.name ?? '—' })
    }
    pipeline = Array.from(byStage.entries()).map(([stage, deals]) => ({ stage, deals }))
  }

  // Open tasks for the end client, due in the next 7 days.
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(); in7.setDate(in7.getDate() + 7)
  const in7iso = in7.toISOString().split('T')[0]
  const { data: tasks } = await supabase
    .from('tasks')
    .select('title, due_date')
    .eq('account_id', engagement?.end_client_account_id ?? '')
    .is('completed_at', null)
    .gte('due_date', today)
    .lte('due_date', in7iso)

  return {
    engagement,
    weekStart,
    weekEnd,
    hoursWeek: weekMinutes / 60,
    hoursMonth: monthHours.used,
    cap: monthHours.included,
    pctOfCap: monthHours.pct,
    workstreamSplit: Array.from(wsMap.entries()).map(([workstream, hours]) => ({ workstream, hours })),
    pipeline,
    milestonesTouched,
    tasks: ((tasks ?? []) as Array<{ title: string; due_date: string | null }>).map((t) => ({ title: t.title, due: t.due_date })),
  }
}
