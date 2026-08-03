import type { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  findAccountByExactName,
  formatTimeEntry,
  isUuid,
  optionalDate,
  optionalNumber,
  optionalString,
  parseBooleanBody,
  requiredPositiveInt,
  requiredString,
  todayDate,
  TIME_ENTRY_SELECT,
} from './cowork-api'
import { engagementHoursThisMonth, addTier1Account, removeTier1Account } from '@/lib/db/engagements'
import { contributorRate, listContributors } from '@/lib/db/contributors'
import { getMilestone, listMilestones, markMilestoneInvoiced, upsertMilestone } from '@/lib/db/tier1'
import { createInvoice } from '@/lib/db/invoices'
import type { EngagementStatus, EngagementType, Tier1MilestoneWithAccount } from '@/lib/types'

/**
 * Shared engagement/tier-1/time logic for the Cowork REST API. Mirrors the pattern
 * in `lib/cowork-tasks.ts`: helpers throw `CoworkApiError`, and results go through
 * `formatEngagement` / `formatMilestone` so every route returns the same shapes.
 *
 * Everything here runs with the service role (RLS bypassed), so every id from a
 * caller is validated to exist before use. Reuses `lib/db/*` where a function
 * already exists (contributor rate, tier-1 attach/detach, milestone upsert, invoice
 * creation) rather than duplicating it. Those db helpers type their `client` param
 * as the request-scoped server client; the service client is structurally the same
 * Supabase client, so it is passed through the `svc` alias below.
 */

type ServerClient = Awaited<ReturnType<typeof createServerClient>>
const svc = supabaseService as unknown as ServerClient

const ENGAGEMENT_SELECT =
  '*, notice_date, end_client:accounts!end_client_account_id(id,name), billed_via:accounts!billed_via_account_id(id,name)'

const ENGAGEMENT_TYPES = new Set<EngagementType>([
  'client_consulting', 'client_app_build', 'internal_app_build', 'internal_ops',
])
const ENGAGEMENT_STATUSES = new Set<EngagementStatus>([
  'Draft', 'Active', 'Paused', 'Completed', 'Terminated',
])

// Gate name (API) → the date column it sets on tier1_milestones.
const GATE_COLUMN = {
  range_review_decided: 'range_review_decided_at',
  go_live_confirmed: 'go_live_confirmed_at',
  first_po_received: 'first_po_received_at',
} as const
type GateKey = keyof typeof GATE_COLUMN
const GATE_COLUMNS = Object.values(GATE_COLUMN)

type Named = { id: string; name: string } | Array<{ id: string; name: string }> | null | undefined

type EngRow = {
  id: string
  code: string | null
  name: string
  status: EngagementStatus
  engagement_type: EngagementType
  currency: string
  end_client_account_id: string | null
  billed_via_account_id: string | null
  retainer_amount_monthly: number | string | null
  included_hours_monthly: number | null
  day_rate: number | string | null
  performance_fee_default: number | string | null
  start_date: string
  end_date: string | null
  notice_period_days: number | null
  auto_renews: boolean | null
  renewal_term_months: number | null
  notice_date: string | null
  approval_thresholds: unknown
  notes: string | null
  created_at: string
  updated_at: string
  end_client?: Named
  billed_via?: Named
}

function firstRel<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function num(value: number | string | null | undefined): number | null {
  return value == null ? null : Number(value)
}

function monthStartStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// ── Parsers ────────────────────────────────────────────────────────────────

function parseEngagementType(value: unknown, fallback: EngagementType = 'client_consulting'): EngagementType {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value !== 'string' || !ENGAGEMENT_TYPES.has(value as EngagementType)) {
    throw new CoworkApiError(`engagement_type must be one of ${[...ENGAGEMENT_TYPES].join(', ')}`, 400)
  }
  return value as EngagementType
}

function parseEngagementStatus(value: unknown, fallback?: EngagementStatus): EngagementStatus {
  if (value === null || value === undefined || value === '') {
    if (fallback) return fallback
    throw new CoworkApiError('status is required', 400)
  }
  if (typeof value !== 'string' || !ENGAGEMENT_STATUSES.has(value as EngagementStatus)) {
    throw new CoworkApiError(`status must be one of ${[...ENGAGEMENT_STATUSES].join(', ')}`, 400)
  }
  return value as EngagementStatus
}

function parseApprovalThresholds(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new CoworkApiError('approval_thresholds must be an object', 400)
  }
  return value as Record<string, unknown>
}

// ── Lookups / validation ─────────────────────────────────────────────────────

async function assertExists(table: string, id: string, field: string): Promise<void> {
  const { data, error } = await supabaseService.from(table).select('id').eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || `Failed to check ${field}`, 500)
  if (!data) throw new CoworkApiError(`${field}: ${id} not found`, 400)
}

/**
 * Resolve an account from an explicit id or a case-insensitive name. Returns null
 * when neither is supplied. Throws 400 when a name is given but not found (unless
 * `create` is set, in which case a bare account row is created).
 */
async function resolveAccountRef(
  idValue: unknown,
  nameValue: unknown,
  field: string,
  { create = false } = {}
): Promise<string | null> {
  const id = optionalString(idValue)
  if (id) {
    await assertExists('accounts', id, field)
    return id
  }
  const name = optionalString(nameValue)
  if (name) {
    const existing = await findAccountByExactName(name)
    if (existing) return existing.id
    if (create) {
      const { data, error } = await supabaseService.from('accounts').insert({ name }).select('id').single()
      if (error) throw new CoworkApiError(error.message || 'Failed to create account', 500)
      return data.id as string
    }
    throw new CoworkApiError(`${field}: account not found: ${name}`, 400)
  }
  return null
}

async function findEngagementByCode(code: string): Promise<EngRow | null> {
  const { data, error } = await supabaseService
    .from('engagements')
    .select(ENGAGEMENT_SELECT)
    .ilike('code', code)
    .limit(1)
  if (error) throw new CoworkApiError(error.message || 'Failed to load engagement', 500)
  const rows = (data ?? []) as unknown as EngRow[]
  return rows.find((r) => (r.code ?? '').toLowerCase() === code.toLowerCase()) ?? null
}

/** Resolve an engagement by uuid or code. Throws 404 if not found. */
export async function getEngagementRow(ref: string): Promise<EngRow> {
  const column = isUuid(ref) ? 'id' : 'code'
  const { data, error } = await supabaseService
    .from('engagements')
    .select(ENGAGEMENT_SELECT)
    .eq(column, ref)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new CoworkApiError(error.message || 'Failed to load engagement', 500)
  const row = ((data ?? []) as unknown as EngRow[])[0]
  if (!row) throw new CoworkApiError(`Engagement not found: ${ref}`, 404)
  return row
}

async function findMilestone(engagementId: string, accountId: string): Promise<Tier1MilestoneWithAccount | null> {
  const { data, error } = await supabaseService
    .from('tier1_milestones')
    .select('*, account:accounts(id,name,channel)')
    .eq('engagement_id', engagementId)
    .eq('account_id', accountId)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load milestone', 500)
  return (data as unknown as Tier1MilestoneWithAccount | null) ?? null
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatEngagement(e: EngRow) {
  const endClient = firstRel(e.end_client)
  const billedVia = firstRel(e.billed_via)
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    status: e.status,
    engagement_type: e.engagement_type,
    currency: e.currency,
    end_client: endClient ? { id: endClient.id, name: endClient.name } : null,
    billed_via: billedVia ? { id: billedVia.id, name: billedVia.name } : null,
    end_client_account_id: e.end_client_account_id,
    billed_via_account_id: e.billed_via_account_id,
    retainer_amount_monthly: num(e.retainer_amount_monthly),
    included_hours_monthly: e.included_hours_monthly,
    day_rate: num(e.day_rate),
    performance_fee_default: num(e.performance_fee_default),
    start_date: e.start_date,
    end_date: e.end_date,
    notice_period_days: e.notice_period_days,
    auto_renews: Boolean(e.auto_renews),
    renewal_term_months: e.renewal_term_months,
    notice_date: e.notice_date ?? null,
    approval_thresholds: e.approval_thresholds ?? {},
    notes: e.notes,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }
}

export function formatMilestone(m: Tier1MilestoneWithAccount) {
  const account = firstRel(m.account)
  return {
    id: m.id,
    account: account ? { id: account.id, name: account.name, channel: account.channel } : null,
    account_id: m.account_id,
    range_review_decided_at: m.range_review_decided_at,
    go_live_confirmed_at: m.go_live_confirmed_at,
    first_po_received_at: m.first_po_received_at,
    is_complete: m.is_complete,
    completed_at: m.completed_at,
    performance_fee: num(m.performance_fee),
    fee_invoice_id: m.fee_invoice_id,
    invoiced: Boolean(m.fee_invoice_id),
    notes: m.notes,
  }
}

// ── Engagements ──────────────────────────────────────────────────────────────

export async function listEngagements(
  filters: { status?: EngagementStatus; accountId?: string; limit?: number } = {}
) {
  const limit = filters.limit ?? 50
  let query = supabaseService
    .from('engagements')
    .select(ENGAGEMENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.accountId) query = query.eq('end_client_account_id', filters.accountId)
  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load engagements', 500)
  const engagements = (data ?? []) as unknown as EngRow[]
  const ids = engagements.map((e) => e.id)
  if (ids.length === 0) return []

  const monthStart = monthStartStr()
  const [summaryRes, billingRes, hoursRes] = await Promise.all([
    supabaseService.from('tier1_milestone_summary').select('*').in('engagement_id', ids),
    supabaseService.from('engagement_billing_summary').select('*').in('engagement_id', ids),
    supabaseService.from('engagement_hours_by_month').select('*').in('engagement_id', ids).eq('period_month', monthStart),
  ])
  const summaryBy = new Map((summaryRes.data ?? []).map((s) => [s.engagement_id as string, s]))
  const billingBy = new Map((billingRes.data ?? []).map((b) => [b.engagement_id as string, b]))
  const hoursBy = new Map((hoursRes.data ?? []).map((h) => [h.engagement_id as string, h]))

  return engagements.map((e) => {
    const base = formatEngagement(e)
    const summary = summaryBy.get(e.id) as { total_tracked?: number; completed?: number } | undefined
    const billing = billingBy.get(e.id) as { total_outstanding?: number | string } | undefined
    const hours = hoursBy.get(e.id) as { hours_used?: number | string; hours_over?: number | string } | undefined
    const used = Number(hours?.hours_used ?? 0)
    return {
      id: base.id,
      code: base.code,
      name: base.name,
      status: base.status,
      end_client: base.end_client,
      billed_via: base.billed_via,
      start_date: base.start_date,
      end_date: base.end_date,
      retainer_amount_monthly: base.retainer_amount_monthly,
      included_hours_monthly: base.included_hours_monthly,
      hours_used_this_month: Math.round(used * 100) / 100,
      hours_over: Math.round(Number(hours?.hours_over ?? used - (base.included_hours_monthly ?? 0)) * 100) / 100,
      tier1_complete: Number(summary?.completed ?? 0),
      tier1_tracked: Number(summary?.total_tracked ?? 0),
      outstanding_invoice_total: Number(billing?.total_outstanding ?? 0),
    }
  })
}

export async function getEngagementDetail(ref: string) {
  const e = await getEngagementRow(ref)
  const monthStart = monthStartStr()
  const [contributors, hoursRes, summaryRes, billingRes, milestones, projectsRes] = await Promise.all([
    listContributors(e.id, svc),
    supabaseService.from('engagement_hours_by_month').select('*').eq('engagement_id', e.id).eq('period_month', monthStart).limit(1),
    supabaseService.from('tier1_milestone_summary').select('*').eq('engagement_id', e.id).maybeSingle(),
    supabaseService.from('engagement_billing_summary').select('*').eq('engagement_id', e.id).maybeSingle(),
    listMilestones(e.id, svc),
    supabaseService.from('projects').select('id, name, status').eq('engagement_id', e.id).order('created_at', { ascending: true }),
  ])

  const hoursRow = (hoursRes.data ?? [])[0] as { hours_used?: number | string; billable_hours?: number | string } | undefined
  const used = Number(hoursRow?.hours_used ?? 0)
  const included = e.included_hours_monthly
  const summary = summaryRes.data as Record<string, number | string> | null
  const billing = billingRes.data as Record<string, number | string> | null

  return {
    ...formatEngagement(e),
    contributors: contributors.map((c) => ({
      id: c.id,
      person: c.person ? { id: c.person.id, name: c.person.full_name, email: c.person.email } : null,
      role: c.role,
      hourly_rate_gbp: Number(c.hourly_rate_gbp),
      is_active: c.is_active,
    })),
    hours_this_month: {
      used: Math.round(used * 100) / 100,
      included,
      over: Math.round((used - (included ?? 0)) * 100) / 100,
      billable: Math.round(Number(hoursRow?.billable_hours ?? 0) * 100) / 100,
    },
    tier1_summary: {
      total_tracked: Number(summary?.total_tracked ?? 0),
      completed: Number(summary?.completed ?? 0),
      in_progress: Number(summary?.in_progress ?? 0),
      billable_not_invoiced: Number(summary?.billable_not_invoiced ?? 0),
      invoiced: Number(summary?.invoiced ?? 0),
    },
    billing: billing
      ? {
          invoice_count: Number(billing.invoice_count ?? 0),
          // All money here is GBP-normalised (mixed-currency engagements sum
          // correctly). currency_count > 1 flags a mixed-currency engagement.
          currency_count: Number(billing.currency_count ?? 0),
          currencies: (billing.currencies as unknown as string[] | null) ?? [],
          total_invoiced: Number(billing.total_invoiced ?? 0),
          total_paid: Number(billing.total_paid ?? 0),
          total_outstanding: Number(billing.total_outstanding ?? 0),
          total_draft: Number(billing.total_draft ?? 0),
          next_due_date: (billing.next_due_date as string | null) ?? null,
          last_payment_at: (billing.last_payment_at as string | null) ?? null,
        }
      : { invoice_count: 0, currency_count: 0, currencies: [], total_invoiced: 0, total_paid: 0, total_outstanding: 0, total_draft: 0, next_due_date: null, last_payment_at: null },
    milestones: milestones.map((m) => formatMilestone(m as Tier1MilestoneWithAccount)),
    projects: (projectsRes.data ?? []) as Array<{ id: string; name: string; status: string }>,
  }
}

export async function createEngagement(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const startDate = optionalDate(body.start_date, 'start_date')
  if (!startDate) throw new CoworkApiError('start_date is required (YYYY-MM-DD)', 400)

  const endClientId = await resolveAccountRef(body.end_client_account_id, body.end_client_account_name, 'end_client')
  if (!endClientId) throw new CoworkApiError('end_client_account_id or end_client_account_name is required', 400)
  const billedViaId = await resolveAccountRef(body.billed_via_account_id, body.billed_via_account_name, 'billed_via')

  const code = optionalString(body.code)
  if (code && (await findEngagementByCode(code))) {
    throw new CoworkApiError(`Engagement code already exists: ${code}`, 409)
  }

  const insert = {
    name,
    start_date: startDate,
    engagement_type: parseEngagementType(body.engagement_type),
    status: parseEngagementStatus(body.status, 'Draft'),
    end_client_account_id: endClientId,
    billed_via_account_id: billedViaId,
    code,
    currency: optionalString(body.currency) ?? 'GBP',
    retainer_amount_monthly: optionalNumber(body.retainer_amount_monthly, 'retainer_amount_monthly'),
    included_hours_monthly: optionalNumber(body.included_hours_monthly, 'included_hours_monthly'),
    day_rate: optionalNumber(body.day_rate, 'day_rate'),
    performance_fee_default: optionalNumber(body.performance_fee_default, 'performance_fee_default'),
    end_date: optionalDate(body.end_date, 'end_date'),
    notice_period_days: optionalNumber(body.notice_period_days, 'notice_period_days'),
    auto_renews: body.auto_renews === true,
    renewal_term_months: optionalNumber(body.renewal_term_months, 'renewal_term_months'),
    approval_thresholds: parseApprovalThresholds(body.approval_thresholds) ?? {},
    notes: optionalString(body.notes),
  }

  const { data, error } = await supabaseService.from('engagements').insert(insert).select(ENGAGEMENT_SELECT).single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create engagement', 500)
  return formatEngagement(data as unknown as EngRow)
}

export async function updateEngagement(ref: string, body: Record<string, unknown>) {
  const e = await getEngagementRow(ref)
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) patch.name = requiredString(body.name, 'name')
  if (body.status !== undefined) patch.status = parseEngagementStatus(body.status)
  if (body.engagement_type !== undefined) patch.engagement_type = parseEngagementType(body.engagement_type)
  if (body.currency !== undefined) patch.currency = optionalString(body.currency) ?? 'GBP'
  if (body.retainer_amount_monthly !== undefined) patch.retainer_amount_monthly = optionalNumber(body.retainer_amount_monthly, 'retainer_amount_monthly')
  if (body.included_hours_monthly !== undefined) patch.included_hours_monthly = optionalNumber(body.included_hours_monthly, 'included_hours_monthly')
  if (body.day_rate !== undefined) patch.day_rate = optionalNumber(body.day_rate, 'day_rate')
  if (body.performance_fee_default !== undefined) patch.performance_fee_default = optionalNumber(body.performance_fee_default, 'performance_fee_default')
  if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, 'end_date')
  if (body.notice_period_days !== undefined) patch.notice_period_days = optionalNumber(body.notice_period_days, 'notice_period_days')
  if (body.auto_renews !== undefined) patch.auto_renews = body.auto_renews === true
  if (body.renewal_term_months !== undefined) patch.renewal_term_months = optionalNumber(body.renewal_term_months, 'renewal_term_months')
  if (body.notes !== undefined) patch.notes = optionalString(body.notes)
  if (body.approval_thresholds !== undefined) patch.approval_thresholds = parseApprovalThresholds(body.approval_thresholds) ?? {}

  if (body.start_date !== undefined) {
    const d = optionalDate(body.start_date, 'start_date')
    if (!d) throw new CoworkApiError('start_date cannot be cleared', 400)
    patch.start_date = d
  }

  if (body.code !== undefined) {
    const code = optionalString(body.code)
    if (code) {
      const existing = await findEngagementByCode(code)
      if (existing && existing.id !== e.id) throw new CoworkApiError(`Engagement code already exists: ${code}`, 409)
    }
    patch.code = code
  }

  if (body.end_client_account_id !== undefined || body.end_client_account_name !== undefined) {
    const id = await resolveAccountRef(body.end_client_account_id, body.end_client_account_name, 'end_client')
    if (!id) throw new CoworkApiError('end_client cannot be cleared', 400)
    patch.end_client_account_id = id
  }
  if (body.billed_via_account_id !== undefined || body.billed_via_account_name !== undefined) {
    patch.billed_via_account_id = await resolveAccountRef(body.billed_via_account_id, body.billed_via_account_name, 'billed_via')
  }

  if (Object.keys(patch).length === 0) throw new CoworkApiError('No changes supplied', 400)

  const { data, error } = await supabaseService.from('engagements').update(patch).eq('id', e.id).select(ENGAGEMENT_SELECT).single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update engagement', 500)
  return formatEngagement(data as unknown as EngRow)
}

// ── Tier-1 accounts ──────────────────────────────────────────────────────────

export async function listTier1(ref: string) {
  const e = await getEngagementRow(ref)
  const { data, error } = await supabaseService
    .from('engagement_tier1_accounts')
    .select('account_id, notes, added_at, account:accounts(id, name, channel)')
    .eq('engagement_id', e.id)
    .order('added_at', { ascending: true })
  if (error) throw new CoworkApiError(error.message || 'Failed to load tier-1 accounts', 500)
  return ((data ?? []) as unknown as Array<{ account_id: string; notes: string | null; added_at: string; account: { id: string; name: string; channel: string | null } | { id: string; name: string; channel: string | null }[] | null }>).map((r) => {
    const account = firstRel(r.account)
    return { account_id: r.account_id, account: account ? { id: account.id, name: account.name, channel: account.channel } : null, notes: r.notes, added_at: r.added_at }
  })
}

export async function addTier1(ref: string, body: Record<string, unknown>) {
  const e = await getEngagementRow(ref)
  const accountId = await resolveAccountRef(body.account_id, body.account_name, 'account', { create: body.create_if_missing === true })
  if (!accountId) throw new CoworkApiError('account_id or account_name is required', 400)
  await addTier1Account(e.id, accountId, num(e.performance_fee_default), optionalString(body.notes) ?? undefined, svc)
  return listTier1(e.id)
}

export async function removeTier1(ref: string, accountId: string) {
  const e = await getEngagementRow(ref)
  const id = optionalString(accountId)
  if (!id) throw new CoworkApiError('account_id is required', 400)
  await removeTier1Account(e.id, id, svc)
}

// ── Milestones ───────────────────────────────────────────────────────────────

export async function getMilestones(ref: string) {
  const e = await getEngagementRow(ref)
  const ms = await listMilestones(e.id, svc)
  return ms.map((m) => formatMilestone(m as Tier1MilestoneWithAccount))
}

/**
 * Set or clear a milestone's gates / fee / attached invoice for one tier-1 account.
 * Upserts the milestone row (seeding performance_fee from the engagement default)
 * when it does not exist yet. Never writes is_complete — the DB trigger derives it
 * and completed_at from the three date columns.
 */
export async function setMilestone(ref: string, accountId: string, body: Record<string, unknown>) {
  const e = await getEngagementRow(ref)
  const acct = optionalString(accountId)
  if (!acct) throw new CoworkApiError('account_id is required', 400)
  await assertExists('accounts', acct, 'account_id')

  let milestone = await findMilestone(e.id, acct)
  if (!milestone) {
    await upsertMilestone({ engagementId: e.id, accountId: acct, performanceFee: num(e.performance_fee_default) }, svc)
    milestone = await findMilestone(e.id, acct)
  }
  if (!milestone) throw new CoworkApiError('Failed to load milestone', 500)

  const patch: Record<string, unknown> = {}

  if (body.gate !== undefined) {
    const gate = body.gate
    if (typeof gate !== 'string' || !(gate in GATE_COLUMN)) {
      throw new CoworkApiError(`gate must be one of ${Object.keys(GATE_COLUMN).join(', ')}`, 400)
    }
    patch[GATE_COLUMN[gate as GateKey]] = body.date === null ? null : optionalDate(body.date, 'date')
  }

  for (const col of GATE_COLUMNS) {
    if (body[col] !== undefined) patch[col] = body[col] === null ? null : optionalDate(body[col], col)
  }
  if (body.performance_fee !== undefined) patch.performance_fee = optionalNumber(body.performance_fee, 'performance_fee')
  if (body.notes !== undefined) patch.notes = optionalString(body.notes)
  if (body.fee_invoice_id !== undefined) {
    const invId = optionalString(body.fee_invoice_id)
    if (invId) await assertExists('invoices', invId, 'fee_invoice_id')
    patch.fee_invoice_id = invId
  }

  if (Object.keys(patch).length === 0) throw new CoworkApiError('No changes supplied', 400)

  // Direct update (still fires the stamp_tier1_completion trigger). is_complete is
  // a generated column and is never in the patch.
  const { error } = await supabaseService.from('tier1_milestones').update(patch).eq('id', milestone.id)
  if (error) throw new CoworkApiError(error.message || 'Failed to update milestone', 500)

  const full = await getMilestone(milestone.id, svc)
  return formatMilestone(full as Tier1MilestoneWithAccount)
}

// ── Milestone performance-fee invoice (shared with the OS route) ──────────────

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

/**
 * Raise the performance-fee invoice for a completed milestone. Recipient = the
 * engagement's billed_via account (falls back to end client), invoice is stamped
 * with both engagement_id and the milestone's fee_invoice_id. Shared by the OS
 * route (`/api/milestones/[id]/invoice`) and the Cowork route so the logic lives
 * in one place. Pass the request-scoped client from the OS route, or `svc` here.
 */
export async function raiseMilestoneInvoice(milestoneId: string, client: ServerClient) {
  const milestone = await getMilestone(milestoneId, client)
  if (!milestone) throw new CoworkApiError('Milestone not found', 404)
  if (!milestone.is_complete) throw new CoworkApiError('Milestone is not complete', 400)
  if (milestone.fee_invoice_id) throw new CoworkApiError('Already invoiced', 400)

  const { data: engagement, error: engErr } = await client
    .from('engagements')
    .select('id, name, currency, end_client_account_id, billed_via_account_id, end_client:accounts!end_client_account_id(name), billed_via:accounts!billed_via_account_id(name)')
    .eq('id', milestone.engagement_id)
    .single()
  if (engErr || !engagement) throw new CoworkApiError('Engagement not found', 404)

  const eng = engagement as unknown as {
    id: string
    name: string
    end_client_account_id: string
    billed_via_account_id: string | null
    end_client?: { name: string } | { name: string }[] | null
    billed_via?: { name: string } | { name: string }[] | null
  }
  const endClient = firstRel(eng.end_client)
  const billedVia = firstRel(eng.billed_via)
  const recipientAccountId = eng.billed_via_account_id ?? eng.end_client_account_id
  const recipientName = billedVia?.name ?? endClient?.name ?? null
  const endClientName = endClient?.name ?? 'end client'
  const fee = milestone.performance_fee ?? 0

  const today = new Date()
  const due = new Date(today)
  due.setDate(due.getDate() + 30)

  const invoice = await createInvoice(
    {
      account_id: recipientAccountId,
      contact_id: null,
      workstream_id: null,
      engagement_id: eng.id,
      status: 'draft',
      issue_date: isoDate(today),
      due_date: isoDate(due),
      line_items: [
        {
          id: crypto.randomUUID(),
          description: `Performance fee — Tier 1 listing: ${milestone.account?.name ?? 'account'} (${eng.name})`,
          qty: 1,
          unit_price: fee,
        },
      ],
      vat_rate: 0,
      bill_to_name: recipientName,
      bill_to_address: null,
      bill_to_city: null,
      bill_to_postcode: null,
      bill_to_country: null,
      bill_to_email: null,
      bill_to_phone: null,
      notes: `Performance fee for confirmed Tier 1 listing. End client: ${endClientName}.`,
    },
    client
  )

  await markMilestoneInvoiced(milestoneId, invoice.id, client)
  return invoice
}

/** Cowork entry point: raise the fee invoice for a (engagement, account) milestone. */
export async function raiseMilestoneInvoiceByAccount(ref: string, accountId: string) {
  const e = await getEngagementRow(ref)
  const acct = optionalString(accountId)
  if (!acct) throw new CoworkApiError('account_id is required', 400)
  const milestone = await findMilestone(e.id, acct)
  if (!milestone) throw new CoworkApiError('No milestone for that account on this engagement', 404)
  return raiseMilestoneInvoice(milestone.id, svc)
}

// ── Documents ────────────────────────────────────────────────────────────────

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
}
function guessMime(name: string): string {
  return MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

const MAX_DOC_BYTES = 25 * 1024 * 1024

export async function listEngagementDocuments(ref: string) {
  const e = await getEngagementRow(ref)
  const { data, error } = await supabaseService
    .from('engagement_documents')
    .select('id, type, title, file_name, mime_type, size_bytes, week_start, created_at')
    .eq('engagement_id', e.id)
    .order('created_at', { ascending: false })
  if (error) throw new CoworkApiError(error.message || 'Failed to load documents', 500)
  return data ?? []
}

/**
 * Upload a document to an engagement from the Cowork API / MCP. Content is JSON:
 * either `content_base64` (any file) or `content` (utf-8 text). Stored in the
 * engagement-docs bucket via the service role; a failed row insert rolls the
 * object back so nothing orphans.
 */
export async function uploadEngagementDocument(
  ref: string,
  body: { file_name?: unknown; content_base64?: unknown; content?: unknown; mime_type?: unknown; title?: unknown }
) {
  const e = await getEngagementRow(ref)
  const fileName = optionalString(body.file_name)
  if (!fileName) throw new CoworkApiError('file_name is required', 400)

  let bytes: Buffer
  if (body.content_base64 !== undefined && body.content_base64 !== null) {
    const b64 = String(body.content_base64).replace(/^data:[^;]+;base64,/, '') // tolerate data URLs
    bytes = Buffer.from(b64, 'base64')
    if (bytes.length === 0 && b64.length > 0) throw new CoworkApiError('content_base64 is not valid base64', 400)
  } else if (body.content !== undefined && body.content !== null) {
    bytes = Buffer.from(String(body.content), 'utf-8')
  } else {
    throw new CoworkApiError('Provide content_base64 (any file) or content (text)', 400)
  }
  if (bytes.length === 0) throw new CoworkApiError('Document is empty', 400)
  if (bytes.length > MAX_DOC_BYTES) throw new CoworkApiError('Document exceeds the 25 MB limit', 400)

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
  const path = `${e.id}/${Date.now()}-${safeName}`
  const mime = optionalString(body.mime_type) ?? guessMime(safeName)

  const { error: upErr } = await supabaseService.storage
    .from('engagement-docs')
    .upload(path, bytes, { contentType: mime, upsert: false })
  if (upErr) throw new CoworkApiError(upErr.message || 'Upload failed', 500)

  const { data: doc, error: insErr } = await supabaseService
    .from('engagement_documents')
    .insert({
      engagement_id: e.id,
      type: 'upload',
      title: optionalString(body.title) ?? fileName,
      file_path: path,
      file_name: fileName,
      mime_type: mime,
      size_bytes: bytes.length,
    })
    .select('id, type, title, file_name, mime_type, size_bytes, created_at')
    .single()
  if (insErr) {
    await supabaseService.storage.from('engagement-docs').remove([path]).then(() => {}, () => {})
    throw new CoworkApiError(insErr.message || 'Failed to save document', 500)
  }
  return { document: doc as { id: string; title: string | null; file_name: string | null; mime_type: string | null; size_bytes: number | null; type: string; created_at: string }, engagement: { id: e.id, name: e.name } }
}

/** Current-month hours used vs included for an engagement (by uuid or code). */
export async function engagementMonthUsage(ref: string) {
  const e = await getEngagementRow(ref)
  const h = await engagementHoursThisMonth(e.id, e.included_hours_monthly, svc)
  return { engagement_id: e.id, used: h.used, included: h.included, over: h.over, pct: h.pct }
}

// ── Time ─────────────────────────────────────────────────────────────────────

async function rpcScalar(fn: 'owner_user_id' | 'owner_person_id'): Promise<string | null> {
  const { data, error } = await supabaseService.rpc(fn)
  if (error) throw new CoworkApiError(error.message || `Failed to resolve ${fn}`, 500)
  return (data as string | null) ?? null
}

export interface LogTimeResult {
  entry: ReturnType<typeof formatTimeEntry>
  warning?: { over_by_hours: number; included: number }
}

/**
 * Create a completed manual time entry (source 'cowork'). Requires duration_minutes
 * and one of engagement_id / project_id / task_id. Sets user_id and person_id from
 * the owner functions (the service role has no auth session), and snapshots a rate
 * so the hour can be billed as overage: explicit rate_snapshot → the contributor's
 * engagement rate → the account default rate → 0.
 */
export async function logTime(body: Record<string, unknown>): Promise<LogTimeResult> {
  const durationMinutes = requiredPositiveInt(body.duration_minutes, 'duration_minutes')
  const engagementId = optionalString(body.engagement_id)
  const projectId = optionalString(body.project_id)
  const taskId = optionalString(body.task_id)
  const accountId = optionalString(body.account_id)
  if (!engagementId && !projectId && !taskId) {
    throw new CoworkApiError('one of engagement_id, project_id or task_id is required', 400)
  }
  const entryDate = optionalDate(body.entry_date, 'entry_date') ?? todayDate()
  const billable = body.billable === undefined ? true : parseBooleanBody(body.billable, 'billable') ?? true

  // Validate every supplied reference (service role bypasses RLS).
  let engagement: EngRow | null = null
  if (engagementId) engagement = await getEngagementRow(engagementId)
  if (projectId) await assertExists('projects', projectId, 'project_id')
  if (taskId) await assertExists('tasks', taskId, 'task_id')
  if (accountId) await assertExists('accounts', accountId, 'account_id')

  const ownerUserId = await rpcScalar('owner_user_id')
  if (!ownerUserId) throw new CoworkApiError('No owner user is configured (owner_user_id returned null)', 500)
  const ownerPersonId = await rpcScalar('owner_person_id')

  // Rate: explicit → contributor rate → account default → 0.
  let rate = optionalNumber(body.rate_snapshot, 'rate_snapshot')
  if (rate == null && engagement && ownerPersonId) {
    rate = await contributorRate(engagement.id, ownerPersonId, svc)
  }
  if (rate == null) {
    const rateAccountId = accountId ?? engagement?.end_client_account_id ?? null
    if (rateAccountId) {
      const { data } = await supabaseService.from('accounts').select('default_hourly_rate').eq('id', rateAccountId).maybeSingle()
      const acctRate = (data as { default_hourly_rate: number | string | null } | null)?.default_hourly_rate
      rate = acctRate != null ? Number(acctRate) : null
    }
  }
  const rateSnapshot = rate ?? 0

  const { data, error } = await supabaseService
    .from('time_entries')
    .insert({
      user_id: ownerUserId,
      person_id: ownerPersonId,
      account_id: accountId,
      project_id: projectId,
      engagement_id: engagement?.id ?? null,
      task_id: taskId,
      entry_date: entryDate,
      start_at: null,
      end_at: null,
      duration_minutes: durationMinutes,
      description: optionalString(body.description),
      billable,
      rate_snapshot: rateSnapshot,
      currency_snapshot: 'GBP',
      source: 'cowork',
      is_running: false,
    })
    .select(TIME_ENTRY_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to log time', 500)

  const result: LogTimeResult = { entry: formatTimeEntry(data as never) }

  // Overage warning: did this push the engagement past its monthly included hours?
  if (engagement && engagement.included_hours_monthly != null) {
    const h = await engagementHoursThisMonth(engagement.id, engagement.included_hours_monthly, svc)
    if (h.over > 0) {
      result.warning = { over_by_hours: Math.round(h.over * 100) / 100, included: engagement.included_hours_monthly }
    }
  }
  return result
}
