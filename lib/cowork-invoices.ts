import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  INVOICE_SELECT,
  findAccountByName,
  findContactByName,
  formatInvoice,
  getInvoiceById,
  getWorkstreamBySlug,
  noRecognisedFieldsError,
  optionalDate,
  optionalLinkedId,
  optionalString,
  parseInvoiceCurrencyFields,
  parseInvoiceListStatus,
  parseInvoiceStatus,
  parseLineItems,
  parseVatRate,
  todayDate,
} from './cowork-api'
import { getEngagementRow } from './cowork-engagements'
import {
  createPayment,
  deletePayment,
  invoiceTotal,
  listPayments,
  recalcInvoicePaymentState,
  updatePayment,
} from '@/lib/db/invoice-payments'
import { billCoworkExpenses, unbilledExpensesFor } from '@/lib/cowork-expenses'
import { softDeleteInvoice } from '@/lib/db/invoices'
import { fetchWiseRate } from '@/lib/fx/wise'
import { deriveInvoiceBillTo } from '@/lib/invoice-bill-to'
import { isSupportedCurrency } from '@/lib/money'
import { roundMoney, type Account, type Contact, type InvoicePayment } from '@/lib/types'

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

  // Non-GBP with no rate supplied → snapshot today's Wise mid-market rate
  // automatically, so "raise a USD invoice" works without quoting a rate. A
  // failed lookup falls through to the explicit supply-a-rate 400.
  const currencyBody: Record<string, unknown> = { ...body }
  const requestedCurrency = (optionalString(body.currency) ?? 'GBP').toUpperCase()
  const hasRate = (body.fx_rate_quote ?? body.fx_rate_to_gbp) != null && body.fx_rate_quote !== '' && body.fx_rate_to_gbp !== ''
  if (requestedCurrency !== 'GBP' && isSupportedCurrency(requestedCurrency) && !hasRate) {
    try {
      const wise = await fetchWiseRate('GBP', requestedCurrency)
      currencyBody.fx_rate_quote = wise.rate
      currencyBody.fx_rate_source = `${wise.source} mid-market (auto)`
      currencyBody.fx_rate_date = wise.date
    } catch {
      // fall through — parseInvoiceCurrencyFields rejects with the manual-rate message
    }
  }
  const currencyFields = parseInvoiceCurrencyFields(currencyBody)

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

  // Snapshot who the invoice is addressed to, exactly as the OS form does: the
  // PDF reads these columns, so a later edit to the account never rewrites a sent
  // invoice.
  const billTo = await deriveBillToFor(account?.id ?? null, contact?.id ?? null)

  const { data, error } = await supabaseService
    .from('invoices')
    .insert({
      ...billTo,
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

  // Optional: pull expenses onto the new invoice in the same request. A failure
  // here soft-deletes the just-created invoice so a bad expense id never leaves
  // an orphan draft behind.
  let expenseIds = Array.isArray(body.expense_ids) ? (body.expense_ids as string[]) : []
  const invoiceId = (data as { id: string }).id
  if (body.include_unbilled_expenses === true) {
    const scope = engagement ? { engagement_id: engagement.id } : account?.id ? { account_id: account.id } : null
    if (scope) {
      const unbilled = await unbilledExpensesFor(scope)
      expenseIds = [...new Set([...expenseIds, ...unbilled.expenses.map((e) => e.id)])]
    }
  }
  let invoiceRow = data
  if (expenseIds.length) {
    try {
      const billed = await billCoworkExpenses({ expense_ids: expenseIds, invoice_id: invoiceId })
      void billed
      const { data: refreshed, error: refErr } = await supabaseService.from('invoices').select(INVOICE_SELECT).eq('id', invoiceId).single()
      if (refErr) throw new CoworkApiError(refErr.message, 500)
      invoiceRow = refreshed
    } catch (e) {
      await softDeleteInvoice(invoiceId, supabaseService as never).catch(() => {})
      throw e
    }
  }

  return {
    invoice: formatInvoice(invoiceRow as never),
    engagement: engagement ? { id: engagement.id, name: engagement.name } : null,
  }
}

/** bill_to_* snapshot for an account and/or contact (lib/invoice-bill-to.ts rules). */
async function deriveBillToFor(accountId: string | null, contactId: string | null) {
  const [accountResult, contactResult] = await Promise.all([
    accountId ? supabaseService.from('accounts').select('*').eq('id', accountId).maybeSingle() : null,
    contactId ? supabaseService.from('contacts').select('*').eq('id', contactId).maybeSingle() : null,
  ])
  return deriveInvoiceBillTo(
    (accountResult?.data as Account | null | undefined) ?? null,
    (contactResult?.data as Contact | null | undefined) ?? null
  )
}

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const INVOICE_PATCH_FIELDS = [
  'status',
  'paid_on',
  'due_date',
  'notes',
  'vat_rate',
  'account_id',
  'contact_id',
  'engagement_id',
  'stripe_payment_link',
  'workstream',
  'line_items',
  'currency',
  'fx_rate_to_gbp',
  'fx_rate_quote',
]

export interface UpdatedInvoice {
  invoice: ReturnType<typeof formatInvoice>
  /** Status before this request. */
  priorStatus: string
  /** Columns whose stored value this request changed, with their previous values. */
  before: Record<string, unknown>
  changed: string[]
  /** True when status:'paid' was settled through a ledger payment. */
  paidViaLedger: boolean
}

/**
 * PATCH /api/cowork/invoices/[id]. paid / part_paid go through the payments
 * ledger, never a direct write. Changing account_id or contact_id re-snapshots
 * bill_to_* (as the OS invoice PATCH does). Returns the previous value of every
 * changed column so the call site can log it.
 */
export async function updateCoworkInvoice(id: string, body: Record<string, unknown>): Promise<UpdatedInvoice> {
  // A soft-deleted invoice 404s, consistent with GET.
  const existing = await getInvoiceById(id)
  const patch: Record<string, unknown> = {}

  let markPaid = false
  if (body.status !== undefined) {
    const status = parseInvoiceStatus(body.status)
    if (status === 'part_paid') {
      throw new CoworkApiError('Record a partial payment instead: POST /api/cowork/invoices/{id}/payments', 409)
    }
    if (status === 'paid') markPaid = true
    else patch.status = status
  }
  if (body.paid_on !== undefined && !markPaid) {
    throw new CoworkApiError('paid_on only applies with status: paid (or use the payments endpoint)', 400)
  }

  if (body.due_date !== undefined) patch.due_date = optionalDate(body.due_date, 'due_date')
  if (body.notes !== undefined) patch.notes = optionalString(body.notes)
  if (body.vat_rate !== undefined) patch.vat_rate = parseVatRate(body.vat_rate)
  if (body.account_id !== undefined) patch.account_id = await optionalLinkedId(body.account_id, 'account_id', 'accounts')
  if (body.contact_id !== undefined) patch.contact_id = await optionalLinkedId(body.contact_id, 'contact_id', 'contacts')

  if (body.engagement_id !== undefined) {
    const ref = optionalString(body.engagement_id)
    patch.engagement_id = ref ? (await getEngagementRow(ref)).id : null
  }
  if (body.stripe_payment_link !== undefined) patch.stripe_payment_link = optionalString(body.stripe_payment_link)

  if (body.workstream !== undefined) {
    const slug = optionalString(body.workstream)
    patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }

  if (body.tier !== undefined || body.pricing_tier_id !== undefined) {
    throw new CoworkApiError('Pricing tiers are no longer supported on invoices', 400)
  }

  if (body.line_items !== undefined) patch.line_items = parseLineItems(body.line_items)

  // Currency + FX snapshot. Frozen once sent (409). While draft, the FX rate can
  // be corrected, but the currency itself cannot be switched: line-item prices do
  // not convert themselves, so relabelling 3500 GBP as $3500 would misprice the
  // invoice. Blocking is safer than repricing — raise a new invoice instead.
  if (body.currency !== undefined || body.fx_rate_to_gbp !== undefined || body.fx_rate_quote !== undefined) {
    if (existing.status !== 'draft') {
      throw new CoworkApiError('Currency and FX rate are frozen once an invoice leaves draft.', 409)
    }
    const cf = parseInvoiceCurrencyFields({ ...body, currency: body.currency ?? existing.currency })
    const existingCurrency = (existing.currency as string | null) ?? 'GBP'
    if (cf.currency !== existingCurrency) {
      throw new CoworkApiError(
        `Cannot change an invoice from ${existingCurrency} to ${cf.currency}; line items do not convert. Raise a new ${cf.currency} invoice instead.`,
        409
      )
    }
    patch.currency = cf.currency
    patch.fx_rate_to_gbp = cf.fx_rate_to_gbp
    patch.fx_rate_quote = cf.fx_rate_quote
    patch.fx_rate_date = cf.fx_rate_date
    patch.fx_rate_source = cf.fx_rate_source
  }

  if (
    (patch.account_id !== undefined && patch.account_id !== existing.account_id) ||
    (patch.contact_id !== undefined && patch.contact_id !== existing.contact_id)
  ) {
    const nextAccountId = patch.account_id !== undefined ? (patch.account_id as string | null) : existing.account_id
    const nextContactId = patch.contact_id !== undefined ? (patch.contact_id as string | null) : existing.contact_id
    Object.assign(patch, await deriveBillToFor(nextAccountId, nextContactId))
  }

  if (Object.keys(patch).length === 0 && !markPaid) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, INVOICE_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  let before: Record<string, unknown> = {}
  let changed: string[] = []
  if (Object.keys(patch).length > 0) {
    const { data: prior, error: priorError } = await supabaseService
      .from('invoices')
      .select(Object.keys(patch).join(', '))
      .eq('id', id)
      .single()
    if (priorError) throw new CoworkApiError(priorError.message || 'Failed to load invoice', 500)
    const priorRow = (prior ?? {}) as unknown as Record<string, unknown>
    changed = Object.keys(patch).filter(
      (key) => JSON.stringify(priorRow[key] ?? null) !== JSON.stringify(patch[key] ?? null)
    )
    before = Object.fromEntries(changed.map((key) => [key, priorRow[key] ?? null]))

    const { error } = await supabaseService.from('invoices').update(patch).eq('id', id)
    if (error) throw new CoworkApiError(error.message || 'Failed to update invoice', 500)
  }

  if (markPaid) {
    const invoice = await recordCoworkPayment(id, { paid_on: optionalString(body.paid_on) })
    return { invoice, priorStatus: existing.status, before, changed, paidViaLedger: true }
  }

  const refreshed = await getInvoiceById(id)
  return { invoice: formatInvoice(refreshed as never), priorStatus: existing.status, before, changed, paidViaLedger: false }
}

/**
 * DELETE /api/cowork/invoices/[id]. SOFT delete through softDeleteInvoice (the
 * same path as the OS delete button): stamps deleted_at and releases any billed
 * time and expenses back to unbilled. Refused (409) once money is on the ledger
 * — a payment, or a paid / part_paid status — so the books never lose a receipt.
 */
export async function deleteCoworkInvoice(id: string) {
  const existing = await getInvoiceById(id) // 404 on missing / already deleted
  const payments = await listPayments(id, supabaseService)
  if (payments.length > 0 || existing.status === 'paid' || existing.status === 'part_paid') {
    throw new CoworkApiError(
      `Invoice ${existing.invoice_number} has ${payments.length > 0 ? `${payments.length} payment${payments.length === 1 ? '' : 's'} recorded` : `status ${existing.status}`} and cannot be deleted; delete its payments first, or cancel it instead.`,
      409
    )
  }

  const countLinked = async (table: 'time_entries' | 'expenses') => {
    const { count, error } = await supabaseService
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('invoice_id', id)
    if (error) throw new CoworkApiError(error.message || `Failed to count ${table}`, 500)
    return count ?? 0
  }
  const [releasedTime, releasedExpenses] = await Promise.all([countLinked('time_entries'), countLinked('expenses')])

  try {
    await softDeleteInvoice(id, supabaseService as never)
  } catch (error) {
    throw new CoworkApiError(error instanceof Error ? error.message : 'Failed to delete invoice', 500)
  }

  return {
    invoice: formatInvoice(existing as never),
    released: { time_entries: releasedTime, expenses: releasedExpenses },
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

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const PAYMENT_PATCH_FIELDS = ['paid_on', 'amount', 'method', 'reference', 'notes']

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

async function getPaymentOnInvoice(invoiceId: string, paymentId: string) {
  const invoice = await getInvoiceById(invoiceId) // 404 on missing / soft-deleted
  const payments = await listPayments(invoiceId, supabaseService)
  const payment = payments.find((p) => p.id === paymentId)
  if (!payment) throw new CoworkApiError('Payment not found on this invoice', 404)
  return { invoice, payments, payment }
}

/**
 * PATCH /api/cowork/invoices/[id]/payments/[paymentId] — same rules as the OS
 * route: paid_on not in the future, amount > 0 and within the invoice total
 * alongside the other payments, method from PAYMENT_METHODS. updatePayment
 * re-derives the invoice's status and paid_at from the ledger.
 */
export async function updateCoworkPayment(invoiceId: string, paymentId: string, body: Record<string, unknown>) {
  const { invoice, payments, payment: existing } = await getPaymentOnInvoice(invoiceId, paymentId)
  const patch: Partial<Pick<InvoicePayment, 'paid_on' | 'amount' | 'method' | 'reference' | 'notes'>> = {}

  if (body.paid_on !== undefined) {
    if (typeof body.paid_on !== 'string' || !DATE_RE.test(body.paid_on)) {
      throw new CoworkApiError('paid_on must be a YYYY-MM-DD date', 400)
    }
    if (body.paid_on > todayDate()) throw new CoworkApiError('paid_on cannot be in the future', 400)
    patch.paid_on = body.paid_on
  }
  if (body.amount !== undefined) {
    const amount = roundMoney(Number(body.amount))
    if (!Number.isFinite(amount) || amount <= 0) throw new CoworkApiError('amount must be greater than zero', 400)
    const othersTotal = payments.filter((p) => p.id !== paymentId).reduce((sum, p) => sum + p.amount, 0)
    const total = invoiceTotal(invoice as never)
    if (roundMoney(othersTotal + amount) > total + 0.01) {
      throw new CoworkApiError(`Payment exceeds the outstanding balance of ${roundMoney(total - othersTotal).toFixed(2)}`, 400)
    }
    patch.amount = amount
  }
  if (body.method !== undefined) {
    const method = optionalString(body.method)
    if (method !== null && !PAYMENT_METHODS.has(method)) {
      throw new CoworkApiError('method must be bank_transfer, stripe, card, cash, cheque, or other', 400)
    }
    patch.method = method as InvoicePayment['method']
  }
  if (body.reference !== undefined) patch.reference = optionalString(body.reference)
  if (body.notes !== undefined) patch.notes = optionalString(body.notes)

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, PAYMENT_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  let payment: InvoicePayment
  try {
    payment = await updatePayment(paymentId, patch, supabaseService)
  } catch (error) {
    throw new CoworkApiError(error instanceof Error ? error.message : 'Failed to update payment', 500)
  }
  const refreshed = await getInvoiceById(invoiceId)
  const before = Object.fromEntries(Object.keys(patch).map((key) => [key, existing[key as keyof InvoicePayment] ?? null]))
  return { payment, invoice: formatInvoice(refreshed as never), before, priorStatus: invoice.status }
}

/**
 * DELETE /api/cowork/invoices/[id]/payments/[paymentId]. Permanent; deletePayment
 * re-derives the invoice's status and paid_at (a paid invoice drops back).
 */
export async function deleteCoworkPayment(invoiceId: string, paymentId: string) {
  const { invoice, payment } = await getPaymentOnInvoice(invoiceId, paymentId)
  try {
    await deletePayment(paymentId, supabaseService)
  } catch (error) {
    throw new CoworkApiError(error instanceof Error ? error.message : 'Failed to delete payment', 500)
  }
  const refreshed = await getInvoiceById(invoiceId)
  return { payment, invoice: formatInvoice(refreshed as never), priorStatus: invoice.status }
}
