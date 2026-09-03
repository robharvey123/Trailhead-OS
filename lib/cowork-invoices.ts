import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  INVOICE_SELECT,
  findAccountByName,
  findContactByName,
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
import { createPayment, invoiceTotal, listPayments, recalcInvoicePaymentState } from '@/lib/db/invoice-payments'
import { roundMoney } from '@/lib/types'

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
  // Pricing tiers are gone from invoicing (v2 phase 1). Fail loudly on stale callers.
  if (body.tier !== undefined || body.pricing_tier_id !== undefined) {
    throw new CoworkApiError('Pricing tiers are no longer supported on invoices; price the line items directly', 400)
  }
  const workstreamSlug = optionalString(body.workstream)
  const contactName = optionalString(body.contact_name)
  const accountName = optionalString(body.account_name)
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

  const engagementRef = optionalString(body.engagement_id)
  const engagement = engagementRef ? await getEngagementRow(engagementRef) : null
  if (engagement && !account) {
    const defaultAccountId = engagement.billed_via_account_id ?? engagement.end_client_account_id
    if (defaultAccountId) account = { id: defaultAccountId, name: '' }
  }

  // No due date supplied → derive from the account's payment terms, falling
  // back to the company default (same rule as the OS API and the form).
  let dueDate = optionalDate(body.due_date, 'due_date')
  if (!dueDate) {
    let termsDays: number | null = null
    if (account?.id) {
      const { data } = await supabaseService.from('accounts').select('payment_terms_days').eq('id', account.id).maybeSingle()
      termsDays = (data?.payment_terms_days as number | null) ?? null
    }
    if (termsDays == null) {
      const { data } = await supabaseService.from('os_company_settings').select('default_payment_terms_days').eq('key', 'default').maybeSingle()
      const v = Number(data?.default_payment_terms_days)
      termsDays = Number.isInteger(v) && v >= 0 ? v : 14
    }
    const due = new Date(`${todayDate()}T12:00:00Z`)
    due.setUTCDate(due.getUTCDate() + termsDays)
    dueDate = due.toISOString().slice(0, 10)
  }

  const { data, error } = await supabaseService
    .from('invoices')
    .insert({
      contact_id: contact?.id ?? null,
      account_id: account?.id ?? null,
      workstream_id: workstream?.id ?? null,
      engagement_id: engagement?.id ?? null,
      issue_date: todayDate(),
      due_date: dueDate,
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

/**
 * Set an invoice's status (default 'paid'), returning the prior status for revert.
 * 'paid' goes through the payments ledger: a payment for the outstanding balance
 * is recorded today and the status/paid_at are re-derived — never written directly.
 * 'part_paid' cannot be set at all; record a partial payment instead.
 */
export async function setInvoiceStatus(id: string, status = 'paid'): Promise<MarkedInvoice> {
  const existing = await getInvoiceById(id) // 404s on missing/soft-deleted
  if (status === 'part_paid') {
    throw new CoworkApiError('Record a partial payment instead of setting part_paid directly (POST /api/cowork/invoices/{id}/payments)', 409)
  }
  if (status === 'paid') {
    const invoice = await recordCoworkPayment(id, {})
    return { invoice, before: { status: existing.status } }
  }
  const { error } = await supabaseService.from('invoices').update({ status }).eq('id', id).select(INVOICE_SELECT).single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update invoice', 500)
  // Re-derive in case the ledger disagrees (e.g. 'sent' set on a part-paid invoice).
  await recalcInvoicePaymentState(id, supabaseService)
  const refreshed = await getInvoiceById(id)
  return { invoice: formatInvoice(refreshed as never), before: { status: existing.status } }
}

export interface CoworkPaymentInput {
  paid_on?: string | null
  amount?: number | null
  method?: string | null
  reference?: string | null
  notes?: string | null
}

const PAYMENT_METHODS = new Set(['bank_transfer', 'stripe', 'card', 'cash', 'cheque', 'other'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** List an invoice's payments with the derived totals. */
export async function listCoworkPayments(id: string) {
  const invoice = await getInvoiceById(id)
  const payments = await listPayments(id, supabaseService)
  const total = invoiceTotal(invoice as never)
  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
  return { payments, total, amount_paid: amountPaid, balance: roundMoney(total - amountPaid) }
}

/**
 * Record a payment from Cowork. Amount defaults to the outstanding balance,
 * date defaults to today and is freely editable (backdating is normal).
 */
export async function recordCoworkPayment(id: string, input: CoworkPaymentInput) {
  const invoice = await getInvoiceById(id)
  if (invoice.status === 'draft' || invoice.status === 'cancelled') {
    throw new CoworkApiError(`Cannot record a payment against a ${invoice.status} invoice`, 400)
  }
  const paidOn = input.paid_on ?? todayDate()
  if (!DATE_RE.test(paidOn)) throw new CoworkApiError('paid_on must be a YYYY-MM-DD date', 400)
  if (paidOn > todayDate()) throw new CoworkApiError('paid_on cannot be in the future', 400)
  if (input.method != null && !PAYMENT_METHODS.has(input.method)) {
    throw new CoworkApiError('method must be bank_transfer, stripe, card, cash, cheque, or other', 400)
  }

  const payments = await listPayments(id, supabaseService)
  const total = invoiceTotal(invoice as never)
  const balance = roundMoney(total - payments.reduce((sum, p) => sum + p.amount, 0))
  const amount = input.amount == null ? balance : roundMoney(Number(input.amount))
  if (!Number.isFinite(amount) || amount <= 0) throw new CoworkApiError('amount must be greater than zero (invoice may already be settled)', 400)
  if (amount > balance + 0.01) throw new CoworkApiError(`Payment exceeds the outstanding balance of ${balance.toFixed(2)}`, 400)

  await createPayment(
    {
      invoice_id: id,
      paid_on: paidOn,
      amount,
      currency: (invoice as { currency?: string }).currency ?? 'GBP',
      method: (input.method as never) ?? 'bank_transfer',
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    },
    supabaseService
  )
  const refreshed = await getInvoiceById(id)
  return formatInvoice(refreshed as never)
}
