import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  INVOICE_SELECT,
  findAccountByName,
  findContactByName,
  findPricingTierBySlug,
  formatInvoice,
  getInvoiceById,
  getWorkstreamBySlug,
  optionalDate,
  optionalString,
  parseInvoiceCurrencyFields,
  parseInvoiceListStatus,
  parseLineItems,
  parseVatRate,
  todayDate,
} from './cowork-api'
import { getEngagementRow } from './cowork-engagements'

/**
 * Invoice logic shared by the Cowork REST routes and the MCP tools so the two
 * can't drift. Audit logging stays at the call site (route/tool), not here, so a
 * UI caller of the same building blocks is never logged as Cowork activity.
 */

export async function listCoworkInvoices(filters: { status?: string | null; engagementId?: string | null; limit?: number }) {
  let query = supabaseService
    .from('invoices')
    .select(INVOICE_SELECT)
    .is('deleted_at', null)
    .order('issue_date', { ascending: false })
    .limit(filters.limit ?? 20)
  const status = parseInvoiceListStatus(filters.status ?? null)
  if (status) query = query.eq('status', status)
  if (filters.engagementId) query = query.eq('engagement_id', filters.engagementId)
  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load invoices', 500)
  return (data ?? []).map((row) => formatInvoice(row as never))
}

export interface CreatedInvoice {
  invoice: ReturnType<typeof formatInvoice>
  engagement: { id: string; name: string } | null
}

/** Create an invoice. engagement_id (uuid or code) links it; when no account is
 *  given it defaults to the engagement's billed_via then end client. */
export async function createCoworkInvoice(body: Record<string, unknown>): Promise<CreatedInvoice> {
  const workstreamSlug = optionalString(body.workstream)
  const contactName = optionalString(body.contact_name)
  const accountName = optionalString(body.account_name)
  const tierSlug = optionalString(body.tier)
  const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
  const lineItems = parseLineItems(body.line_items)
  const status = body.status === undefined ? 'draft' : optionalString(body.status)
  if (status !== 'draft' && status !== 'sent') throw new CoworkApiError('status must be draft or sent', 400)

  const currencyFields = parseInvoiceCurrencyFields(body)

  const contact = contactName ? await findContactByName(contactName) : null
  if (contactName && !contact) throw new CoworkApiError(`Contact not found: ${contactName}`, 400)
  let account = accountName
    ? await findAccountByName(accountName)
    : contact?.account_id
      ? { id: contact.account_id, name: '' }
      : null
  if (accountName && !account) throw new CoworkApiError(`Account not found: ${accountName}`, 400)
  const pricingTier = tierSlug ? await findPricingTierBySlug(tierSlug) : null

  const engagementRef = optionalString(body.engagement_id)
  const engagement = engagementRef ? await getEngagementRow(engagementRef) : null
  if (engagement && !account) {
    const defaultAccountId = engagement.billed_via_account_id ?? engagement.end_client_account_id
    if (defaultAccountId) account = { id: defaultAccountId, name: '' }
  }

  const { data, error } = await supabaseService
    .from('invoices')
    .insert({
      contact_id: contact?.id ?? null,
      account_id: account?.id ?? null,
      workstream_id: workstream?.id ?? null,
      engagement_id: engagement?.id ?? null,
      pricing_tier_id: pricingTier?.id ?? null,
      issue_date: todayDate(),
      due_date: optionalDate(body.due_date, 'due_date'),
      vat_rate: parseVatRate(body.vat_rate),
      line_items: lineItems,
      notes: optionalString(body.notes),
      currency: currencyFields.currency,
      fx_rate_to_gbp: currencyFields.fx_rate_to_gbp,
      fx_rate_quote: currencyFields.fx_rate_quote,
      fx_rate_date: currencyFields.fx_rate_date,
      fx_rate_source: currencyFields.fx_rate_source,
      status,
    })
    .select(INVOICE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create invoice', 500)
  return {
    invoice: formatInvoice(data as never),
    engagement: engagement ? { id: engagement.id, name: engagement.name } : null,
  }
}

export interface MarkedInvoice {
  invoice: ReturnType<typeof formatInvoice>
  before: { status: string }
}

/** Set an invoice's status (default 'paid'), returning the prior status for revert. */
export async function setInvoiceStatus(id: string, status = 'paid'): Promise<MarkedInvoice> {
  const existing = await getInvoiceById(id) // 404s on missing/soft-deleted
  const patch: Record<string, unknown> = { status }
  if (status === 'paid') patch.paid_at = new Date().toISOString()
  else patch.paid_at = null
  const { data, error } = await supabaseService.from('invoices').update(patch).eq('id', id).select(INVOICE_SELECT).single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update invoice', 500)
  return { invoice: formatInvoice(data as never), before: { status: existing.status } }
}
