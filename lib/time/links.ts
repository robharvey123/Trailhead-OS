// THE single resolver for time-entry links, billable and rate. Every writer —
// timesheet form, timers, Cowork API, MCP — goes through resolveTimeLinks so a
// row always carries engagement, project, account and person whenever they are
// derivable, and the rate precedence has exactly one owner. The SQL trigger
// time_entries_fill_links (migration 20260911100000) mirrors the LINK half as a
// belt-and-braces net for raw SQL writers; rate stays a TypeScript concern.
//
// Client-agnostic: routes pass the session client, Cowork passes supabaseService.

import type { SupabaseClient } from '@supabase/supabase-js'

export class TimeLinkConflict extends Error {
  status = 409
}

export type TimeLinkInput = {
  task_id?: string | null
  project_id?: string | null
  engagement_id?: string | null
  account_id?: string | null
  person_id?: string | null
  /** Fallback for person via people.auth_user_id. */
  user_id?: string | null
  /** null/undefined = derive from the engagement. */
  billable?: boolean | null
  /** null/undefined = derive; an explicit value (including 0) always wins. */
  rate_snapshot?: number | null
}

export type ResolvedEngagement = {
  id: string
  code: string
  name: string
  is_billable: boolean
  included_hours_monthly: number | null
  end_client_account_id: string | null
  start_date: string | null
  billing_month_start_day: number | null
}

export type RateSource = 'explicit' | 'contributor' | 'project' | 'account' | 'none'

export type ResolvedTimeLinks = {
  task_id: string | null
  project_id: string | null
  engagement_id: string | null
  account_id: string | null
  person_id: string | null
  billable: boolean
  rate_snapshot: number
  rate_source: RateSource
  engagement: ResolvedEngagement | null
}

const ENGAGEMENT_FIELDS =
  'id, code, name, is_billable, included_hours_monthly, end_client_account_id, start_date, billing_month_start_day'

/** Treat a null/zero configured rate as unset (every account row defaults to 0.00). */
function positiveRate(value: number | string | null | undefined): number | null {
  const n = value == null ? null : Number(value)
  return n != null && Number.isFinite(n) && n > 0 ? n : null
}

export async function resolveTimeLinks(input: TimeLinkInput, client: SupabaseClient): Promise<ResolvedTimeLinks> {
  const taskId = input.task_id ?? null
  let projectId = input.project_id ?? null
  let engagementId = input.engagement_id ?? null
  let accountId = input.account_id ?? null
  let personId = input.person_id ?? null
  let projectRate: number | null = null

  // 1. Task → engagement + project. A supplied engagement that contradicts the
  //    task's is a conflict — both values are named, we never silently pick one.
  if (taskId) {
    const { data, error } = await client
      .from('engagement_tasks')
      .select('id, engagement_id, project_id')
      .eq('id', taskId)
      .maybeSingle()
    if (error) throw new Error(error.message || 'Failed to resolve task_id')
    if (!data) throw new Error(`task_id ${taskId} not found`)
    const link = data as { engagement_id: string | null; project_id: string | null }
    if (engagementId && link.engagement_id && engagementId !== link.engagement_id) {
      throw new TimeLinkConflict(
        `engagement_id ${engagementId} conflicts with task ${taskId}, which belongs to engagement ${link.engagement_id}. Omit engagement_id to use the task's, or move the entry to a ticket on ${engagementId}.`
      )
    }
    engagementId = engagementId ?? link.engagement_id
    projectId = projectId ?? link.project_id
  }

  // 2. Project → engagement + account (and the project rate for step 6).
  if (projectId) {
    const { data, error } = await client
      .from('projects')
      .select('id, engagement_id, account_id, hourly_rate')
      .eq('id', projectId)
      .maybeSingle()
    if (error) throw new Error(error.message || 'Failed to resolve project_id')
    if (!data) throw new Error(`project_id ${projectId} not found`)
    const proj = data as { engagement_id: string | null; account_id: string | null; hourly_rate: number | string | null }
    if (engagementId && proj.engagement_id && engagementId !== proj.engagement_id) {
      throw new TimeLinkConflict(
        `engagement_id ${engagementId} conflicts with project ${projectId}, which belongs to engagement ${proj.engagement_id}.`
      )
    }
    engagementId = engagementId ?? proj.engagement_id
    accountId = accountId ?? proj.account_id
    projectRate = positiveRate(proj.hourly_rate)
  }

  // 3. Engagement → account (end client), plus everything billable/periods need.
  let engagement: ResolvedEngagement | null = null
  if (engagementId) {
    const { data, error } = await client.from('engagements').select(ENGAGEMENT_FIELDS).eq('id', engagementId).maybeSingle()
    if (error) throw new Error(error.message || 'Failed to resolve engagement_id')
    if (!data) throw new Error(`engagement_id ${engagementId} not found`)
    engagement = data as unknown as ResolvedEngagement
    accountId = accountId ?? engagement.end_client_account_id
  }

  // 4. Person from the auth user.
  if (!personId && input.user_id) {
    const { data } = await client.from('people').select('id').eq('auth_user_id', input.user_id).limit(1).maybeSingle()
    personId = (data?.id as string | undefined) ?? null
  }

  // 5. Billable: explicit → engagement.is_billable → true.
  const billable = input.billable ?? engagement?.is_billable ?? true

  // 6. Rate: explicit (0 included) → contributor → project → account default → 0.
  let rate: number | null = null
  let rateSource: RateSource = 'none'
  if (input.rate_snapshot != null) {
    rate = Number(input.rate_snapshot)
    rateSource = 'explicit'
  }
  if (rate == null && engagement && personId) {
    const { data } = await client
      .from('engagement_contributors')
      .select('hourly_rate_gbp')
      .eq('engagement_id', engagement.id)
      .eq('person_id', personId)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.hourly_rate_gbp != null) {
      rate = Number(data.hourly_rate_gbp)
      rateSource = 'contributor'
    }
  }
  if (rate == null && projectRate != null) {
    rate = projectRate
    rateSource = 'project'
  }
  if (rate == null && accountId) {
    const { data } = await client.from('accounts').select('default_hourly_rate').eq('id', accountId).maybeSingle()
    const acctRate = positiveRate((data as { default_hourly_rate: number | string | null } | null)?.default_hourly_rate)
    if (acctRate != null) {
      rate = acctRate
      rateSource = 'account'
    }
  }

  return {
    task_id: taskId,
    project_id: projectId,
    engagement_id: engagementId,
    account_id: accountId,
    person_id: personId,
    billable,
    rate_snapshot: rate ?? 0,
    rate_source: rate == null ? 'none' : rateSource,
    engagement,
  }
}
