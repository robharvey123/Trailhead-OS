import { createClient } from '@/lib/supabase/server'
import type {
  OutreachCampaign,
  OutreachCampaignStats,
  OutreachCampaignStep,
  OutreachRecipient,
  OutreachRecipientStatus,
  OutreachTemplate,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export interface CampaignListItem extends OutreachCampaign {
  audience_name: string | null
  stats: OutreachCampaignStats | null
}

/** Campaigns with their audience name and pre-aggregated stats (view, not client-side). */
export async function listCampaignsWithStats(client?: SupabaseClient): Promise<CampaignListItem[]> {
  const supabase = await getSupabase(client)
  const [{ data: campaigns }, { data: stats }, { data: audiences }] = await Promise.all([
    supabase.from('outreach_campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('outreach_campaign_stats').select('*'),
    supabase.from('outreach_audiences').select('id, name'),
  ])
  const statsById = new Map((stats ?? []).map((s) => [(s as OutreachCampaignStats).campaign_id, s as OutreachCampaignStats]))
  const audienceById = new Map((audiences ?? []).map((a) => [a.id as string, a.name as string]))
  return ((campaigns ?? []) as OutreachCampaign[]).map((c) => ({
    ...c,
    audience_name: c.audience_id ? audienceById.get(c.audience_id) ?? null : null,
    stats: statsById.get(c.id) ?? null,
  }))
}

export async function getCampaign(id: string, client?: SupabaseClient): Promise<CampaignListItem | null> {
  const supabase = await getSupabase(client)
  const { data: campaign } = await supabase.from('outreach_campaigns').select('*').eq('id', id).maybeSingle<OutreachCampaign>()
  if (!campaign) return null
  const [{ data: stats }, audienceName] = await Promise.all([
    supabase.from('outreach_campaign_stats').select('*').eq('campaign_id', id).maybeSingle<OutreachCampaignStats>(),
    campaign.audience_id
      ? supabase.from('outreach_audiences').select('name').eq('id', campaign.audience_id).maybeSingle<{ name: string }>().then((r) => r.data?.name ?? null)
      : Promise.resolve(null),
  ])
  return { ...campaign, audience_name: audienceName, stats: stats ?? null }
}

export interface CampaignStepWithTemplate extends OutreachCampaignStep {
  template_name: string | null
}

export async function listCampaignSteps(campaignId: string, client?: SupabaseClient): Promise<CampaignStepWithTemplate[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('outreach_campaign_steps')
    .select('*, template:outreach_templates(name)')
    .eq('campaign_id', campaignId)
    .order('step_number', { ascending: true })
  return ((data ?? []) as unknown as Array<OutreachCampaignStep & { template: { name: string } | null }>).map((s) => ({
    ...s,
    template_name: s.template?.name ?? null,
  }))
}

export interface RecipientRow extends OutreachRecipient {
  contact: { id: string; name: string; company: string | null; email: string | null } | null
}

export async function listRecipients(
  campaignId: string,
  filters: { status?: OutreachRecipientStatus } = {},
  client?: SupabaseClient
): Promise<RecipientRow[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('outreach_recipients')
    .select('*, contact:contacts(id, name, company, email)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (filters.status) query = query.eq('status', filters.status)
  const { data } = await query
  return (data ?? []) as unknown as RecipientRow[]
}

export async function listTemplates(client?: SupabaseClient): Promise<OutreachTemplate[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase.from('outreach_templates').select('*').order('name', { ascending: true })
  return (data ?? []) as OutreachTemplate[]
}

export interface AudienceContact {
  id: string
  name: string
  company: string | null
  email: string | null
  channel: string | null
}

/** Contacts (with an email) in an audience — for the "send test" contact picker. */
export async function listAudienceContacts(audienceId: string, client?: SupabaseClient): Promise<AudienceContact[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('outreach_audience_members')
    .select('contact:contacts(id, name, company, email, channel)')
    .eq('audience_id', audienceId)
  const rows = ((data ?? []) as unknown as Array<{ contact: AudienceContact | null }>)
    .map((r) => r.contact)
    .filter((c): c is AudienceContact => Boolean(c && c.email))
  rows.sort((a, b) => (a.company ?? a.name).localeCompare(b.company ?? b.name))
  return rows
}

export interface AudienceListItem {
  id: string
  name: string
  description: string | null
  created_at: string
  member_count: number
}

export async function listAudiences(client?: SupabaseClient): Promise<AudienceListItem[]> {
  const supabase = await getSupabase(client)
  const [{ data: audiences }, { data: members }] = await Promise.all([
    supabase.from('outreach_audiences').select('*').order('created_at', { ascending: false }),
    supabase.from('outreach_audience_members').select('audience_id'),
  ])
  const counts = new Map<string, number>()
  for (const m of members ?? []) counts.set(m.audience_id as string, (counts.get(m.audience_id as string) ?? 0) + 1)
  return ((audiences ?? []) as Array<{ id: string; name: string; description: string | null; created_at: string }>).map((a) => ({
    ...a,
    member_count: counts.get(a.id) ?? 0,
  }))
}

export interface CallQueueRow {
  recipient_id: string
  contact_id: string
  name: string
  company: string | null
  phone: string | null
  website: string | null
  sub_trade: string | null
  size_signal: string | null
  call_status: string | null
  call_last_at: string | null
  first_delivered_at: string | null
}

/**
 * The follow-up call queue: recipients with at least one delivered-or-later send,
 * whose contact is callable. A number is callable ONLY if it has been CTPS-screened
 * (ctps_checked_at is not null) AND is not registered AND is not do_not_call.
 * Screening must have HAPPENED — an unscreened number is invisible here, never
 * callable, because calling a CTPS-registered number is a PECR reg 21 breach.
 * Earliest delivery first.
 */
export async function getCallQueue(client?: SupabaseClient): Promise<CallQueueRow[]> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('outreach_recipients')
    .select(`
      id, contact_id, call_status, call_last_at,
      contact:contacts!inner(id, name, company, phone, website, sub_trade, size_signal, do_not_call, ctps_registered, ctps_checked_at),
      sends:outreach_sends!inner(status, delivered_at)
    `)
    .in('sends.status', ['delivered', 'opened', 'clicked'])
    .not('contact.do_not_call', 'is', true)
    .not('contact.ctps_registered', 'is', true)
    .not('contact.ctps_checked_at', 'is', null)

  type Raw = {
    id: string
    contact_id: string
    call_status: string | null
    call_last_at: string | null
    contact: { id: string; name: string; company: string | null; phone: string | null; website: string | null; sub_trade: string | null; size_signal: string | null }
    sends: Array<{ status: string; delivered_at: string | null }>
  }
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => {
    const delivered = r.sends.map((s) => s.delivered_at).filter((d): d is string => Boolean(d)).sort()
    return {
      recipient_id: r.id,
      contact_id: r.contact_id,
      name: r.contact.name,
      company: r.contact.company,
      phone: r.contact.phone,
      website: r.contact.website,
      sub_trade: r.contact.sub_trade,
      size_signal: r.contact.size_signal,
      call_status: r.call_status,
      call_last_at: r.call_last_at,
      first_delivered_at: delivered[0] ?? null,
    }
  })
  rows.sort((a, b) => (a.first_delivered_at ?? '').localeCompare(b.first_delivered_at ?? ''))
  return rows
}

/**
 * Delivered prospects that are NOT yet CTPS-screened (ctps_checked_at is null) and
 * aren't do_not_call. These are hidden from the call queue on purpose — the count
 * makes the compliance gap loud instead of silently swallowing contacts.
 */
export async function getUnscreenedCallCount(client?: SupabaseClient): Promise<number> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('outreach_recipients')
    .select('id, contact:contacts!inner(ctps_checked_at, do_not_call), sends:outreach_sends!inner(status)')
    .in('sends.status', ['delivered', 'opened', 'clicked'])
    .not('contact.do_not_call', 'is', true)
    .is('contact.ctps_checked_at', null)
  return (data ?? []).length
}
