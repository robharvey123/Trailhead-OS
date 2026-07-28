import type { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  getWorkstreamBySlug,
  isUuid,
  optionalNumber,
  optionalString,
  requiredString,
} from './cowork-api'
import { listAudiences as dbListAudiences, listCampaignsWithStats, getCampaign, listTemplates as dbListTemplates } from '@/lib/db/outreach'
import { validateCampaignForSend } from '@/lib/outreach/validate'
import { OUTREACH_TEMPLATE_VARS } from '@/lib/outreach/render'
import type { OutreachCampaignStatus } from '@/lib/types'

/**
 * Shared outreach logic for the Cowork REST API and the MCP tools. Suppression is
 * the compliance boundary: every audience build consults email_suppressions (global,
 * unique on lower(email)) and honours do_not_email. Campaigns created here always
 * land in `draft` — Rob approves the send with a separate explicit start call; Claude
 * never fires cold email off its own bat.
 */

type ServerClient = Awaited<ReturnType<typeof createServerClient>>
const svc = supabaseService as unknown as ServerClient

// Valid merge tags = the contact-derived template vars.
const TEMPLATE_VARS = new Set<string>(OUTREACH_TEMPLATE_VARS)

// ── Audiences ────────────────────────────────────────────────────────────────

export async function listAudiences() {
  return dbListAudiences(svc)
}

export async function createAudience(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const { data, error } = await supabaseService
    .from('outreach_audiences')
    .insert({ name, description: optionalString(body.description) })
    .select('id, name, description, created_at')
    .single()
  if (error) {
    if (error.code === '23505') throw new CoworkApiError(`An audience named "${name}" already exists`, 409)
    throw new CoworkApiError(error.message || 'Failed to create audience', 500)
  }
  return { ...data, member_count: 0 }
}

interface MemberFilter {
  workstream?: unknown
  account_id?: unknown
  sub_trade?: unknown
  tag?: unknown
}

/**
 * Snapshot contacts into an audience. Accepts explicit contact_ids OR a filter.
 * Skips anything without an email, flagged do_not_email, or on the suppression
 * list, and returns how many were skipped rather than silently dropping them.
 */
export async function addAudienceMembers(audienceId: string, body: { contact_ids?: unknown; filter?: MemberFilter }) {
  // Audience must exist.
  const { data: audience } = await supabaseService.from('outreach_audiences').select('id').eq('id', audienceId).maybeSingle()
  if (!audience) throw new CoworkApiError('Audience not found', 404)

  type Cand = { id: string; email: string | null; do_not_email: boolean | null }
  let candidates: Cand[] = []

  const ids = Array.isArray(body.contact_ids) ? body.contact_ids.map(String) : null
  if (ids && ids.length > 0) {
    const { data, error } = await supabaseService.from('contacts').select('id, email, do_not_email').in('id', ids)
    if (error) throw new CoworkApiError(error.message, 500)
    candidates = (data ?? []) as Cand[]
  } else if (body.filter) {
    const f = body.filter
    let query = supabaseService.from('contacts').select('id, email, do_not_email')
    if (f.workstream) {
      const ws = await getWorkstreamBySlug(String(f.workstream))
      query = query.eq('workstream_id', ws.id)
    }
    if (f.account_id) query = query.eq('account_id', String(f.account_id))
    if (f.sub_trade) query = query.eq('sub_trade', String(f.sub_trade))
    if (f.tag) query = query.contains('tags', [String(f.tag)])
    const { data, error } = await query.limit(5000)
    if (error) throw new CoworkApiError(error.message, 500)
    candidates = (data ?? []) as Cand[]
  } else {
    throw new CoworkApiError('Provide contact_ids or a filter', 400)
  }

  // Suppression + do_not_email + no-email are all skips.
  const emails = candidates.map((c) => c.email?.trim().toLowerCase()).filter(Boolean) as string[]
  const suppressed = new Set<string>()
  if (emails.length > 0) {
    const { data: sup } = await supabaseService.from('email_suppressions').select('email').in('email', emails)
    for (const s of sup ?? []) suppressed.add(String(s.email).trim().toLowerCase())
  }

  const toAdd: string[] = []
  const skips = { no_email: 0, do_not_email: 0, suppressed: 0 }
  for (const c of candidates) {
    const email = c.email?.trim().toLowerCase()
    if (!email) { skips.no_email++; continue }
    if (c.do_not_email) { skips.do_not_email++; continue }
    if (suppressed.has(email)) { skips.suppressed++; continue }
    toAdd.push(c.id)
  }

  if (toAdd.length > 0) {
    const { error } = await supabaseService
      .from('outreach_audience_members')
      .upsert(toAdd.map((contact_id) => ({ audience_id: audienceId, contact_id })), { onConflict: 'audience_id,contact_id', ignoreDuplicates: true })
    if (error) throw new CoworkApiError(error.message, 500)
  }

  const skipped = skips.no_email + skips.do_not_email + skips.suppressed
  const { count } = await supabaseService.from('outreach_audience_members').select('contact_id', { count: 'exact', head: true }).eq('audience_id', audienceId)
  return { audience_id: audienceId, considered: candidates.length, added: toAdd.length, skipped, skipped_breakdown: skips, member_count: count ?? 0 }
}

// ── Templates ────────────────────────────────────────────────────────────────

const TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function unknownMergeTags(...bodies: (string | null | undefined)[]): string[] {
  const found = new Set<string>()
  for (const body of bodies) {
    if (!body) continue
    let m: RegExpExecArray | null
    TAG_RE.lastIndex = 0
    while ((m = TAG_RE.exec(body))) if (!TEMPLATE_VARS.has(m[1])) found.add(m[1])
  }
  return [...found]
}

export async function listTemplates() {
  return dbListTemplates(svc)
}

export async function createTemplate(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const subject = optionalString(body.subject) ?? ''
  const bodyHtml = optionalString(body.body_html) ?? ''
  const bodyText = optionalString(body.body_text)
  // Warn on unknown merge tags; do not reject.
  const unknown = unknownMergeTags(subject, bodyHtml, bodyText)
  const { data, error } = await supabaseService
    .from('outreach_templates')
    .insert({ name, subject, body_html: bodyHtml, body_text: bodyText })
    .select('id, name, subject, body_html, body_text, created_at, updated_at')
    .single()
  if (error) {
    if (error.code === '23505') throw new CoworkApiError(`A template named "${name}" already exists`, 409)
    throw new CoworkApiError(error.message || 'Failed to create template', 500)
  }
  return { template: data, unknown_merge_tags: unknown }
}

// ── Campaigns ────────────────────────────────────────────────────────────────

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export async function listCampaigns() {
  return (await listCampaignsWithStats(svc)).map(formatCampaignSummary)
}

function formatCampaignSummary(c: Awaited<ReturnType<typeof listCampaignsWithStats>>[number]) {
  return {
    id: c.id,
    name: c.name,
    status: c.status,
    audience: c.audience_name,
    daily_send_cap: c.daily_send_cap,
    stats: c.stats ?? null,
    created_at: c.created_at,
  }
}

export async function createCampaign(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const audienceId = optionalString(body.audience_id)
  if (audienceId) {
    const { data } = await supabaseService.from('outreach_audiences').select('id').eq('id', audienceId).maybeSingle()
    if (!data) throw new CoworkApiError(`Audience not found: ${audienceId}`, 400)
  }

  // Steps: [{ template_id, delay_days }]
  const rawSteps = Array.isArray(body.steps) ? body.steps : []
  const steps = rawSteps.map((s, i) => {
    const step = s as Record<string, unknown>
    const templateId = optionalString(step.template_id)
    if (!templateId) throw new CoworkApiError(`steps[${i}].template_id is required`, 400)
    return { template_id: templateId, delay_days: Math.max(0, Number(step.delay_days) || 0) }
  })

  // Validate send_days (1..7), window, timezone.
  const sendDays = Array.isArray(body.send_days)
    ? [...new Set(body.send_days.map((d) => Number(d)))].filter((d) => WEEKDAYS.includes(d)).sort((a, b) => a - b)
    : undefined
  if (sendDays && sendDays.length === 0) throw new CoworkApiError('send_days must contain ISO weekday numbers 1-7', 400)

  const insert: Record<string, unknown> = {
    name,
    audience_id: audienceId,
    status: 'draft', // never anything else — Rob starts it explicitly
    from_name: optionalString(body.from_name),
    from_email: optionalString(body.from_email),
    reply_to: optionalString(body.reply_to),
    daily_send_cap: optionalNumber(body.daily_send_cap, 'daily_send_cap') ?? 20,
  }
  if (sendDays) insert.send_days = sendDays
  if (optionalString(body.send_window_start)) insert.send_window_start = optionalString(body.send_window_start)
  if (optionalString(body.send_window_end)) insert.send_window_end = optionalString(body.send_window_end)
  if (optionalString(body.timezone)) insert.timezone = optionalString(body.timezone)
  if (optionalString(body.project_id)) insert.project_id = optionalString(body.project_id)

  const { data: campaign, error } = await supabaseService.from('outreach_campaigns').insert(insert).select('id').single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create campaign', 500)

  if (steps.length > 0) {
    // Validate template ids exist.
    const templateIds = [...new Set(steps.map((s) => s.template_id))]
    const { data: templates } = await supabaseService.from('outreach_templates').select('id').in('id', templateIds)
    const known = new Set((templates ?? []).map((t) => t.id))
    for (const s of steps) if (!known.has(s.template_id)) throw new CoworkApiError(`Template not found: ${s.template_id}`, 400)
    const { error: stepErr } = await supabaseService.from('outreach_campaign_steps').insert(
      steps.map((s, i) => ({ campaign_id: campaign.id, step_number: i + 1, template_id: s.template_id, delay_days: s.delay_days }))
    )
    if (stepErr) throw new CoworkApiError(stepErr.message || 'Failed to create steps', 500)
  }

  return getCampaignDetail(campaign.id)
}

const ACTIONS = ['start', 'pause', 'resume', 'cancel'] as const
type CampaignAction = (typeof ACTIONS)[number]

/** start / pause / resume / cancel. `start` validates templates first. */
export async function setCampaignAction(campaignId: string, action: string) {
  if (!ACTIONS.includes(action as CampaignAction)) {
    throw new CoworkApiError(`action must be one of ${ACTIONS.join(', ')}`, 400)
  }
  const { data: campaign } = await supabaseService.from('outreach_campaigns').select('id, status').eq('id', campaignId).maybeSingle<{ id: string; status: OutreachCampaignStatus }>()
  if (!campaign) throw new CoworkApiError('Campaign not found', 404)

  const patch: Record<string, unknown> = {}
  if (action === 'start' || action === 'resume') {
    const error = await validateCampaignForSend(supabaseService, campaignId)
    if (error) throw new CoworkApiError(error, 400)
    patch.status = 'running'
    if (action === 'start') {
      const { data: existing } = await supabaseService.from('outreach_campaigns').select('started_at').eq('id', campaignId).maybeSingle<{ started_at: string | null }>()
      if (existing && !existing.started_at) patch.started_at = new Date().toISOString()
    }
  } else if (action === 'pause') {
    patch.status = 'paused'
  } else if (action === 'cancel') {
    patch.status = 'cancelled'
    patch.completed_at = new Date().toISOString()
  }
  const { error } = await supabaseService.from('outreach_campaigns').update(patch).eq('id', campaignId)
  if (error) throw new CoworkApiError(error.message || 'Failed to update campaign', 500)
  return getCampaignDetail(campaignId)
}

/** Full campaign detail: stats view + per-recipient status counts + recent replies. */
export async function getCampaignDetail(campaignId: string) {
  const campaign = await getCampaign(campaignId, svc)
  if (!campaign) throw new CoworkApiError('Campaign not found', 404)

  const [{ data: recipients }, { data: steps }, { data: replies }] = await Promise.all([
    supabaseService.from('outreach_recipients').select('status, stopped_reason').eq('campaign_id', campaignId),
    supabaseService.from('outreach_campaign_steps').select('step_number, template_id, delay_days, template:outreach_templates(name)').eq('campaign_id', campaignId).order('step_number', { ascending: true }),
    supabaseService.from('outreach_recipients').select('stopped_at, contact:contacts(id, name, company, email)').eq('campaign_id', campaignId).eq('stopped_reason', 'replied').order('stopped_at', { ascending: false }).limit(10),
  ])

  const statusCounts: Record<string, number> = {}
  const stopReasons: Record<string, number> = {}
  for (const r of (recipients ?? []) as Array<{ status: string; stopped_reason: string | null }>) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
    if (r.stopped_reason) stopReasons[r.stopped_reason] = (stopReasons[r.stopped_reason] ?? 0) + 1
  }

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    audience: campaign.audience_name,
    from_name: campaign.from_name,
    from_email: campaign.from_email,
    reply_to: campaign.reply_to,
    daily_send_cap: campaign.daily_send_cap,
    send_window: `${(campaign.send_window_start ?? '').slice(0, 5)}-${(campaign.send_window_end ?? '').slice(0, 5)}`,
    send_days: campaign.send_days,
    timezone: campaign.timezone,
    stats: campaign.stats ?? null,
    recipient_status_counts: statusCounts,
    stopped_reasons: stopReasons,
    steps: ((steps ?? []) as Array<{ step_number: number; delay_days: number; template: { name: string } | { name: string }[] | null }>).map((s) => ({
      step_number: s.step_number,
      delay_days: s.delay_days,
      template: Array.isArray(s.template) ? s.template[0]?.name ?? null : s.template?.name ?? null,
    })),
    recent_replies: ((replies ?? []) as Array<{ stopped_at: string | null; contact: { id: string; name: string; company: string | null; email: string | null } | { id: string; name: string; company: string | null; email: string | null }[] | null }>).map((r) => {
      const contact = Array.isArray(r.contact) ? r.contact[0] : r.contact
      return { at: r.stopped_at, contact: contact ? { id: contact.id, name: contact.name, company: contact.company, email: contact.email } : null }
    }),
    created_at: campaign.created_at,
  }
}

/** Resolve a campaign id from a uuid, else throw. (Campaigns have no external code.) */
export function requireCampaignId(id: string): string {
  if (!isUuid(id)) throw new CoworkApiError('campaign id must be a uuid', 400)
  return id
}
