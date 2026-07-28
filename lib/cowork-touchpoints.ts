import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  TOUCHPOINT_SELECT,
  findAccountByExactName,
  findContactByName,
  formatTouchpoint,
  optionalIsoDatetime,
  optionalString,
  parseTouchpointType,
  requiredString,
} from './cowork-api'
import { getEngagementRow } from './cowork-engagements'

/**
 * Shared touchpoint logic for the Cowork API (bearer + service role). Mirrors
 * lib/cowork-engagements.ts. Note this is the service-role path — never import it
 * into anything the browser can reach; the session route (/api/touchpoints) stays
 * on the request-scoped client.
 */

export async function listCoworkTouchpoints(filters: {
  engagementRef?: string
  accountId?: string
  contactId?: string
  type?: string
  from?: string
  to?: string
  limit?: number
}) {
  let query = supabaseService
    .from('touchpoints')
    .select(TOUCHPOINT_SELECT)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50)

  if (filters.engagementRef) {
    const engagement = await getEngagementRow(filters.engagementRef) // accepts uuid or code
    query = query.eq('engagement_id', engagement.id)
  }
  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.contactId) query = query.eq('contact_id', filters.contactId)
  if (filters.type) query = query.eq('type', parseTouchpointType(filters.type))
  if (filters.from) query = query.gte('occurred_at', filters.from)
  if (filters.to) query = query.lte('occurred_at', filters.to)

  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load touchpoints', 500)
  return (data ?? []).map((row) => formatTouchpoint(row as never))
}

/** Create a touchpoint. Requires subject + at least one target (engagement/account/contact). */
export async function createCoworkTouchpoint(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  const subject = requiredString(b.subject, 'subject')
  const type = parseTouchpointType(b.type)

  const engagementRef = optionalString(b.engagement) ?? optionalString(b.engagement_id)
  const engagement = engagementRef ? await getEngagementRow(engagementRef) : null

  let accountId = optionalString(b.account_id)
  const accountName = optionalString(b.account_name)
  if (!accountId && accountName) {
    const acc = await findAccountByExactName(accountName)
    if (!acc) throw new CoworkApiError(`Account not found: ${accountName}`, 400)
    accountId = acc.id
  }

  let contactId = optionalString(b.contact_id)
  const contactName = optionalString(b.contact_name)
  if (!contactId && contactName) {
    const contact = await findContactByName(contactName)
    if (!contact) throw new CoworkApiError(`Contact not found: ${contactName}`, 400)
    contactId = contact.id
  }

  if (!engagement && !accountId && !contactId) {
    throw new CoworkApiError('one of engagement, account_id/account_name or contact_id/contact_name is required', 400)
  }

  const occurredAt = optionalIsoDatetime(b.occurred_at, 'occurred_at') ?? new Date().toISOString()

  const { data, error } = await supabaseService
    .from('touchpoints')
    .insert({
      engagement_id: engagement?.id ?? null,
      account_id: accountId,
      contact_id: contactId,
      type,
      subject,
      body: optionalString(b.body),
      occurred_at: occurredAt,
    })
    .select(TOUCHPOINT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create touchpoint', 500)
  return formatTouchpoint(data as never)
}
