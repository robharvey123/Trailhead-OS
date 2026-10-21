import type { SupabaseClient } from '@supabase/supabase-js'
import { getCallEligibility, type CallEligibility, type CallEligibilityReason } from '@/lib/outreach/call-eligibility'

/**
 * Reads for the Sales Lead seat. Always called with the signed-in user's
 * client, so RLS decides what comes back: the seat sees only in-scope
 * contacts. The scope filter below also runs for owner/admin, so they see
 * exactly what the seat sees.
 */

export interface SalesContactRow {
  id: string
  name: string
  company: string | null
  role: string | null
  email: string | null
  phone: string | null
  city: string | null
  sub_trade: string | null
  size_signal: string | null
  tags: string[]
  do_not_call: boolean | null
  do_not_email: boolean | null
  eligibility: CallEligibility | null
}

export const ELIGIBILITY_LABELS: Record<CallEligibilityReason, string> = {
  eligible: 'Callable',
  do_not_call: 'Do not call',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  ctps_registered: 'On CTPS',
  unscreened: 'Not screened',
  ctps_stale: 'Screen expired',
  no_phone: 'No phone',
}

export async function getSalesScopePrefixes(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('sales_scope_tag_prefixes').select('prefix').order('prefix')
  return (data ?? []).map((r) => String(r.prefix))
}

export function tagsInScope(tags: readonly string[] | null | undefined, prefixes: readonly string[]): boolean {
  const lowered = prefixes.map((p) => p.toLowerCase())
  return (tags ?? []).some((t) => lowered.some((p) => t.trim().toLowerCase().startsWith(p)))
}

const CONTACT_COLUMNS = 'id, name, company, role, email, phone, city, sub_trade, size_signal, tags, do_not_call, do_not_email'

export async function listSalesContacts(supabase: SupabaseClient): Promise<SalesContactRow[]> {
  const [prefixes, { data, error }] = await Promise.all([
    getSalesScopePrefixes(supabase),
    supabase.from('contacts').select(CONTACT_COLUMNS).is('merged_into', null).order('company', { ascending: true }),
  ])
  if (error) throw new Error(error.message)
  const rows = ((data ?? []) as Omit<SalesContactRow, 'eligibility'>[]).filter((c) => tagsInScope(c.tags, prefixes))
  const eligibility = await getCallEligibility(supabase, rows.map((r) => r.id))
  return rows.map((r) => ({ ...r, eligibility: eligibility.get(r.id) ?? null }))
}

export interface SalesSummary {
  inScope: number
  callable: number
  needsScreening: number
  unsubscribedOrBounced: number
  byTag: Array<{ tag: string; count: number }>
}

export function summarise(contacts: SalesContactRow[], prefixes: readonly string[]): SalesSummary {
  const byTag = new Map<string, number>()
  for (const c of contacts) {
    for (const t of c.tags ?? []) {
      if (tagsInScope([t], prefixes)) byTag.set(t, (byTag.get(t) ?? 0) + 1)
    }
  }
  const reason = (c: SalesContactRow) => c.eligibility?.reason
  return {
    inScope: contacts.length,
    callable: contacts.filter((c) => reason(c) === 'eligible').length,
    needsScreening: contacts.filter((c) => reason(c) === 'unscreened' || reason(c) === 'ctps_stale').length,
    unsubscribedOrBounced: contacts.filter((c) => reason(c) === 'unsubscribed' || reason(c) === 'bounced').length,
    byTag: Array.from(byTag, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  }
}

export interface SalesProduct {
  id: string
  name: string
  description: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  estimated_end_date: string | null
  updated_at: string | null
}

export async function listSalesProducts(supabase: SupabaseClient): Promise<SalesProduct[]> {
  const { data } = await supabase.from('sales_products').select('*').order('name')
  return (data ?? []) as SalesProduct[]
}

export interface SalesContactRecord {
  contact: SalesContactRow & { notes: string | null; website: string | null; status: string | null }
  campaigns: Array<{
    recipient_id: string
    campaign_name: string
    status: string
    stopped_reason: string | null
    sends: Array<{
      id: string
      subject: string | null
      status: string
      sent_at: string | null
      delivered_at: string | null
      first_opened_at: string | null
      first_clicked_at: string | null
    }>
  }>
  touchpoints: Array<{ id: string; type: string; subject: string; body: string | null; occurred_at: string }>
}

export async function getSalesContactRecord(supabase: SupabaseClient, contactId: string): Promise<SalesContactRecord | null> {
  const prefixes = await getSalesScopePrefixes(supabase)
  const { data: contact } = await supabase
    .from('contacts')
    .select(`${CONTACT_COLUMNS}, notes, website, status`)
    .eq('id', contactId)
    .is('merged_into', null)
    .maybeSingle()
  if (!contact || !tagsInScope((contact as { tags: string[] }).tags, prefixes)) return null

  const [eligibility, { data: recipients }, { data: touchpoints }] = await Promise.all([
    getCallEligibility(supabase, [contactId]),
    supabase
      .from('outreach_recipients')
      .select('id, campaign_id, status, stopped_reason')
      .eq('contact_id', contactId),
    supabase
      .from('touchpoints')
      .select('id, type, subject, body, occurred_at')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false })
      .limit(100),
  ])

  const recs = (recipients ?? []) as Array<{ id: string; campaign_id: string; status: string; stopped_reason: string | null }>
  const [{ data: campaigns }, { data: sends }] = await Promise.all([
    recs.length
      ? supabase.from('sales_campaigns').select('id, name').in('id', recs.map((r) => r.campaign_id))
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    recs.length
      ? supabase
          .from('outreach_sends')
          .select('id, recipient_id, subject, status, sent_at, delivered_at, first_opened_at, first_clicked_at')
          .in('recipient_id', recs.map((r) => r.id))
          .order('sent_at', { ascending: true })
      : Promise.resolve({ data: [] as unknown[] }),
  ])
  const nameById = new Map(((campaigns ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
  type SendRow = SalesContactRecord['campaigns'][number]['sends'][number] & { recipient_id: string }
  const sendRows = (sends ?? []) as SendRow[]

  return {
    contact: { ...(contact as SalesContactRecord['contact']), eligibility: eligibility.get(contactId) ?? null },
    campaigns: recs.map((r) => ({
      recipient_id: r.id,
      campaign_name: nameById.get(r.campaign_id) ?? 'Campaign',
      status: r.status,
      stopped_reason: r.stopped_reason,
      sends: sendRows.filter((s) => s.recipient_id === r.id),
    })),
    touchpoints: (touchpoints ?? []) as SalesContactRecord['touchpoints'],
  }
}
