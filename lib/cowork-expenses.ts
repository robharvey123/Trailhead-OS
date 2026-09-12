// Shared expense logic for the Cowork REST routes and MCP tools, mirroring
// lib/cowork-engagements' time-entry pattern: helpers throw CoworkApiError,
// results go through formatExpense, everything runs on the service role with
// every caller-supplied id validated before use.

import { supabaseService } from '@/lib/supabase/service'
import {
  CoworkApiError,
  EXPENSE_SELECT,
  findAccountByName,
  formatExpense,
  formatInvoice,
  getInvoiceById,
  getWorkstreamBySlug,
  INVOICE_SELECT,
  noRecognisedFieldsError,
  optionalDate,
  optionalString,
  parseBooleanBody,
  parseExpenseCategory,
  todayDate,
} from './cowork-api'
import { getEngagementRow, rpcScalar } from './cowork-engagements'
import { markExpensesAsBilled } from '@/lib/db/expenses'
import type { createClient as createServerClient } from '@/lib/supabase/server'
import type { LineItem } from '@/lib/types'

type ServerClient = Awaited<ReturnType<typeof createServerClient>>
const svc = supabaseService as unknown as ServerClient

export type FormattedExpense = ReturnType<typeof formatExpense>

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** The generated invoice line for an expense — the exact shape the browser form uses. */
function expenseLineDescription(e: { description: string; date: string }): string {
  return `Expense: ${e.description} (${e.date})`
}

// ── List ─────────────────────────────────────────────────────────────────────

export interface ExpenseListFilters {
  engagementRef?: string | null
  projectId?: string | null
  accountId?: string | null
  category?: string | null
  billable?: boolean
  billed?: boolean
  from?: string | null
  to?: string | null
  limit?: number
}

type SummaryGroup = { count: number; total: number }

function summarise(expenses: FormattedExpense[]) {
  const currencies = [...new Set(expenses.map((e) => e.currency))].sort()
  const mixed = currencies.length > 1
  const totalOf = (rows: FormattedExpense[]) => round2(rows.reduce((s, e) => s + e.amount, 0))

  const byCategory = new Map<string, SummaryGroup>()
  for (const e of expenses) {
    const g = byCategory.get(e.category) ?? { count: 0, total: 0 }
    g.count++
    g.total = round2(g.total + e.amount)
    byCategory.set(e.category, g)
  }
  const byEngagement = new Map<string, { engagement_id: string | null; code: string | null; count: number; total: number; unbilled_billable_total: number }>()
  for (const e of expenses) {
    const key = e.engagement?.id ?? 'none'
    const g = byEngagement.get(key) ?? { engagement_id: e.engagement?.id ?? null, code: e.engagement?.code ?? null, count: 0, total: 0, unbilled_billable_total: 0 }
    g.count++
    g.total = round2(g.total + e.amount)
    if (e.billable && !e.billed) g.unbilled_billable_total = round2(g.unbilled_billable_total + e.amount)
    byEngagement.set(key, g)
  }

  const summary: Record<string, unknown> = {
    count: expenses.length,
    by_category: [...byCategory.entries()].map(([category, g]) => ({ category, ...g })),
    by_engagement: [...byEngagement.values()],
  }
  if (mixed) {
    // Totals never convert between currencies; mixed lists report per currency.
    summary.currencies = currencies
    summary.by_currency = currencies.map((c) => {
      const rows = expenses.filter((e) => e.currency === c)
      return {
        currency: c,
        total: totalOf(rows),
        billable_total: totalOf(rows.filter((e) => e.billable)),
        unbilled_billable_total: totalOf(rows.filter((e) => e.billable && !e.billed)),
      }
    })
  } else {
    summary.total = totalOf(expenses)
    summary.billable_total = totalOf(expenses.filter((e) => e.billable))
    summary.unbilled_billable_total = totalOf(expenses.filter((e) => e.billable && !e.billed))
  }
  return summary
}

export async function listCoworkExpenses(filters: ExpenseListFilters) {
  const limit = Math.min(filters.limit ?? 100, 500)
  // A bad engagement ref 404s here rather than falling through to all rows.
  const engagement = filters.engagementRef ? await getEngagementRow(filters.engagementRef) : null

  let query = supabaseService
    .from('expenses')
    .select(EXPENSE_SELECT)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (engagement) query = query.eq('engagement_id', engagement.id)
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.category) query = query.eq('category', parseExpenseCategory(filters.category))
  if (filters.billable !== undefined) query = query.eq('billable', filters.billable)
  if (filters.billed !== undefined) query = query.eq('billed', filters.billed)
  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)

  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load expenses', 500)
  const expenses = (data ?? []).map((row) => formatExpense(row as never))
  return { expenses, summary: summarise(expenses) }
}

// ── Link derivation (same order as logTime) ──────────────────────────────────

async function deriveExpenseLinks(input: {
  engagementRef: string | null
  projectId: string | null
  accountId: string | null
}): Promise<{ engagementId: string | null; projectId: string | null; accountId: string | null; engagementIsBillable: boolean | null }> {
  let engagementId: string | null = null
  let engagementIsBillable: boolean | null = null
  if (input.engagementRef) {
    const e = await getEngagementRow(input.engagementRef)
    engagementId = e.id
    // ENGAGEMENT_SELECT is `*`, so is_billable (a generated column) is present
    // at runtime even though EngRow doesn't type it.
    engagementIsBillable = Boolean((e as unknown as { is_billable?: boolean }).is_billable)
  }
  const projectId = input.projectId
  let accountId = input.accountId

  if (projectId) {
    const { data, error } = await supabaseService.from('projects').select('id, engagement_id, account_id').eq('id', projectId).maybeSingle()
    if (error) throw new CoworkApiError(error.message || 'Failed to resolve project_id', 500)
    if (!data) throw new CoworkApiError(`project_id ${projectId} not found`, 404)
    const proj = data as { engagement_id: string | null; account_id: string | null }
    if (engagementId && proj.engagement_id && engagementId !== proj.engagement_id) {
      throw new CoworkApiError(
        `engagement_id ${engagementId} conflicts with project ${projectId}, which belongs to engagement ${proj.engagement_id}.`,
        409,
        { project_engagement_id: proj.engagement_id }
      )
    }
    if (!engagementId && proj.engagement_id) {
      const e = await getEngagementRow(proj.engagement_id)
      engagementId = e.id
      engagementIsBillable = Boolean((e as unknown as { is_billable?: boolean }).is_billable)
    }
    accountId = accountId ?? proj.account_id
  }

  if (engagementId && !accountId) {
    const e = await getEngagementRow(engagementId)
    accountId = e.end_client_account_id ?? null
  }

  return { engagementId, projectId, accountId, engagementIsBillable }
}

// ── Create / read / amend / delete ───────────────────────────────────────────

export async function createCoworkExpense(body: Record<string, unknown>): Promise<FormattedExpense> {
  const description = optionalString(body.description)
  if (!description) throw new CoworkApiError('description is required', 400)
  const amountRaw = Number(body.amount)
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) throw new CoworkApiError('amount must be a positive number', 400)
  const amount = round2(amountRaw)

  const currency = (optionalString(body.currency) ?? 'GBP').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new CoworkApiError('currency must be a 3-letter code', 400)
  const category = parseExpenseCategory(body.category)

  let accountId = optionalString(body.account_id)
  const accountName = optionalString(body.account_name)
  if (!accountId && accountName) {
    const account = await findAccountByName(accountName)
    if (!account) throw new CoworkApiError(`Account not found: ${accountName}`, 400)
    accountId = account.id
  }
  if (accountId && optionalString(body.account_id)) {
    const { data } = await supabaseService.from('accounts').select('id').eq('id', accountId).maybeSingle()
    if (!data) throw new CoworkApiError(`account_id ${accountId} not found`, 404)
  }

  const workstreamSlug = optionalString(body.workstream)
  const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

  const links = await deriveExpenseLinks({
    engagementRef: optionalString(body.engagement_id),
    projectId: optionalString(body.project_id),
    accountId,
  })

  const billable =
    body.billable === undefined
      ? links.engagementId != null && links.engagementIsBillable === true
      : parseBooleanBody(body.billable, 'billable') ?? false

  const ownerUserId = await rpcScalar('owner_user_id')
  if (!ownerUserId) throw new CoworkApiError('No owner user is configured (owner_user_id returned null)', 500)

  const { data, error } = await supabaseService
    .from('expenses')
    .insert({
      date: optionalDate(body.date, 'date') ?? todayDate(),
      description,
      amount,
      currency,
      category,
      receipt_url: optionalString(body.receipt_url),
      workstream_id: workstream?.id ?? null,
      account_id: links.accountId,
      project_id: links.projectId,
      engagement_id: links.engagementId,
      billable,
      billed: false,
      invoice_id: null,
      tax_deductible: body.tax_deductible === undefined ? true : parseBooleanBody(body.tax_deductible, 'tax_deductible') ?? true,
      notes: optionalString(body.notes),
      source: 'cowork',
      user_id: ownerUserId,
    })
    .select(EXPENSE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create expense', 500)
  return formatExpense(data as never)
}

export async function getCoworkExpense(id: string): Promise<FormattedExpense> {
  const { data, error } = await supabaseService.from('expenses').select(EXPENSE_SELECT).eq('id', id).maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load expense', 500)
  if (!data) throw new CoworkApiError(`expense ${id} not found`, 404)
  return formatExpense(data as never)
}

const PATCHABLE = ['description', 'amount', 'date', 'currency', 'category', 'engagement_id', 'project_id', 'account_id', 'account_name', 'workstream', 'billable', 'tax_deductible', 'notes', 'receipt_url']
const BILLED_FROZEN = ['amount', 'currency', 'date', 'billable']

export async function patchCoworkExpense(id: string, body: Record<string, unknown>): Promise<FormattedExpense> {
  const current = await getCoworkExpense(id)
  if (!PATCHABLE.some((f) => f in body)) throw noRecognisedFieldsError(body, PATCHABLE)

  if (current.billed) {
    const frozen = BILLED_FROZEN.filter((f) => f in body)
    if (frozen.length) {
      throw new CoworkApiError(
        `Expense is already on invoice ${current.invoice?.invoice_number ?? current.invoice?.id ?? ''}; release it first`.trim(),
        409,
        { frozen_fields: frozen }
      )
    }
  }

  const updates: Record<string, unknown> = {}
  if ('description' in body) {
    const d = optionalString(body.description)
    if (!d) throw new CoworkApiError('description cannot be empty', 400)
    updates.description = d
  }
  if ('amount' in body) {
    const a = Number(body.amount)
    if (!Number.isFinite(a) || a <= 0) throw new CoworkApiError('amount must be a positive number', 400)
    updates.amount = round2(a)
  }
  if ('date' in body) updates.date = optionalDate(body.date, 'date') ?? current.date
  if ('currency' in body) {
    const c = (optionalString(body.currency) ?? 'GBP').toUpperCase()
    if (!/^[A-Z]{3}$/.test(c)) throw new CoworkApiError('currency must be a 3-letter code', 400)
    updates.currency = c
  }
  if ('category' in body) updates.category = parseExpenseCategory(body.category)
  if ('billable' in body) updates.billable = parseBooleanBody(body.billable, 'billable') ?? current.billable
  if ('tax_deductible' in body) updates.tax_deductible = parseBooleanBody(body.tax_deductible, 'tax_deductible') ?? current.tax_deductible
  if ('notes' in body) updates.notes = optionalString(body.notes)
  if ('receipt_url' in body) updates.receipt_url = optionalString(body.receipt_url)
  if ('workstream' in body) {
    const slug = optionalString(body.workstream)
    updates.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }

  // Re-run link derivation only when a link actually changes.
  const linkTouched = 'engagement_id' in body || 'project_id' in body || 'account_id' in body || 'account_name' in body
  if (linkTouched) {
    let accountId = 'account_id' in body ? optionalString(body.account_id) : current.account?.id ?? null
    const accountName = optionalString(body.account_name)
    if ('account_name' in body && accountName) {
      const account = await findAccountByName(accountName)
      if (!account) throw new CoworkApiError(`Account not found: ${accountName}`, 400)
      accountId = account.id
    }
    const links = await deriveExpenseLinks({
      engagementRef: 'engagement_id' in body ? optionalString(body.engagement_id) : current.engagement?.id ?? null,
      projectId: 'project_id' in body ? optionalString(body.project_id) : current.project?.id ?? null,
      accountId,
    })
    updates.engagement_id = links.engagementId
    updates.project_id = links.projectId
    updates.account_id = links.accountId
  }

  const { data, error } = await supabaseService.from('expenses').update(updates).eq('id', id).select(EXPENSE_SELECT).single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update expense', 500)
  return formatExpense(data as never)
}

/** Hard delete (the table has no deleted_at). Returns the deleted row for the audit `before`. */
export async function deleteCoworkExpense(id: string): Promise<FormattedExpense> {
  const current = await getCoworkExpense(id)
  if (current.billed) {
    throw new CoworkApiError(`Expense is already on invoice ${current.invoice?.invoice_number ?? ''}; release it first`.trim(), 409)
  }
  const { error } = await supabaseService.from('expenses').delete().eq('id', id)
  if (error) throw new CoworkApiError(error.message || 'Failed to delete expense', 500)
  return current
}

// ── Billing ──────────────────────────────────────────────────────────────────

/**
 * Put expenses onto an invoice: one line item per expense in the exact shape
 * the browser form generates, then mark them billed. Invoice totals need no
 * separate recalculation — subtotal/VAT/total are always derived from
 * line_items via calculateTotals, nothing is stored.
 */
export async function billCoworkExpenses(input: { expense_ids: string[]; invoice_id: string }) {
  const ids = input.expense_ids
  if (!Array.isArray(ids) || ids.length === 0) throw new CoworkApiError('expense_ids is required', 400)

  const { data: rows, error } = await supabaseService.from('expenses').select(EXPENSE_SELECT).in('id', ids)
  if (error) throw new CoworkApiError(error.message || 'Failed to load expenses', 500)
  const expenses = (rows ?? []).map((r) => formatExpense(r as never))
  const found = new Set(expenses.map((e) => e.id))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length) throw new CoworkApiError('Some expense ids do not exist', 400, { missing })
  const notBillable = expenses.filter((e) => !e.billable).map((e) => e.id)
  const alreadyBilled = expenses.filter((e) => e.billed).map((e) => e.id)
  if (notBillable.length || alreadyBilled.length) {
    throw new CoworkApiError('Some expenses cannot be billed', 400, {
      ...(notBillable.length ? { not_billable: notBillable } : {}),
      ...(alreadyBilled.length ? { already_billed: alreadyBilled } : {}),
    })
  }

  const invoice = await getInvoiceById(input.invoice_id) // 404s on missing/deleted
  const invoiceStatus = (invoice as { status: string }).status
  if (invoiceStatus !== 'draft' && invoiceStatus !== 'sent') {
    throw new CoworkApiError(`Invoice is ${invoiceStatus}; expenses can only be billed onto a draft or sent invoice`, 409)
  }
  const invoiceCurrency = ((invoice as { currency?: string | null }).currency ?? 'GBP').toUpperCase()
  for (const e of expenses) {
    if (e.currency.toUpperCase() !== invoiceCurrency) {
      throw new CoworkApiError(`Expense currency ${e.currency} does not match invoice currency ${invoiceCurrency}`, 409, { expense_id: e.id })
    }
  }

  const lineItems = [
    ...(((invoice as { line_items?: LineItem[] }).line_items ?? []) as LineItem[]),
    ...expenses.map((e) => ({
      id: crypto.randomUUID(),
      description: expenseLineDescription(e),
      qty: 1,
      unit_price: e.amount,
    })),
  ]
  const { data: updatedInvoice, error: invErr } = await supabaseService
    .from('invoices')
    .update({ line_items: lineItems })
    .eq('id', input.invoice_id)
    .select(INVOICE_SELECT)
    .single()
  if (invErr) throw new CoworkApiError(invErr.message || 'Failed to add expense lines to the invoice', 500)

  await markExpensesAsBilled(ids, input.invoice_id, svc)

  const { data: after } = await supabaseService.from('expenses').select(EXPENSE_SELECT).in('id', ids)
  return {
    invoice: formatInvoice(updatedInvoice as never),
    expenses: (after ?? []).map((r) => formatExpense(r as never)),
  }
}

/** Release billed expenses: unmark them and strip their generated line items. */
export async function releaseCoworkExpenses(input: { expense_ids: string[] }) {
  const ids = input.expense_ids
  if (!Array.isArray(ids) || ids.length === 0) throw new CoworkApiError('expense_ids is required', 400)

  const { data: rows, error } = await supabaseService.from('expenses').select(EXPENSE_SELECT).in('id', ids)
  if (error) throw new CoworkApiError(error.message || 'Failed to load expenses', 500)
  const expenses = (rows ?? []).map((r) => formatExpense(r as never))
  const billedRows = expenses.filter((e) => e.billed && e.invoice)

  // Strip the matching generated line item from each invoice (first exact match).
  const byInvoice = new Map<string, FormattedExpense[]>()
  for (const e of billedRows) {
    const list = byInvoice.get(e.invoice!.id) ?? []
    list.push(e)
    byInvoice.set(e.invoice!.id, list)
  }
  for (const [invoiceId, invExpenses] of byInvoice) {
    const invoice = await getInvoiceById(invoiceId)
    const status = (invoice as { status: string }).status
    if (status === 'paid' || status === 'part_paid') {
      throw new CoworkApiError(`Invoice ${(invoice as { invoice_number: string }).invoice_number} is ${status}; release the payment first`, 409)
    }
    let lineItems = (((invoice as { line_items?: LineItem[] }).line_items ?? []) as LineItem[])
    for (const e of invExpenses) {
      const target = expenseLineDescription(e)
      const idx = lineItems.findIndex((li) => li.description === target)
      if (idx >= 0) lineItems = [...lineItems.slice(0, idx), ...lineItems.slice(idx + 1)]
    }
    const { error: invErr } = await supabaseService.from('invoices').update({ line_items: lineItems }).eq('id', invoiceId)
    if (invErr) throw new CoworkApiError(invErr.message || 'Failed to remove expense lines from the invoice', 500)
  }

  const { error: relErr } = await supabaseService.from('expenses').update({ billed: false, invoice_id: null }).in('id', ids)
  if (relErr) throw new CoworkApiError(relErr.message || 'Failed to release expenses', 500)

  const { data: after } = await supabaseService.from('expenses').select(EXPENSE_SELECT).in('id', ids)
  return { expenses: (after ?? []).map((r) => formatExpense(r as never)) }
}

// ── Aggregates for engagement detail / MCP ───────────────────────────────────

/** Unbilled billable expenses for a resolved engagement or account uuid. */
export async function unbilledExpensesFor(scope: { engagement_id?: string | null; account_id?: string | null }) {
  let query = supabaseService
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('billable', true)
    .eq('billed', false)
    .order('date', { ascending: false })
  if (scope.engagement_id) query = query.eq('engagement_id', scope.engagement_id)
  else if (scope.account_id) query = query.eq('account_id', scope.account_id)
  else return { expenses: [] as FormattedExpense[], count: 0, total: 0, currencies: [] as string[] }

  const { data, error } = await query
  if (error) throw new CoworkApiError(error.message || 'Failed to load unbilled expenses', 500)
  const expenses = (data ?? []).map((r) => formatExpense(r as never))
  const currencies = [...new Set(expenses.map((e) => e.currency))].sort()
  return {
    expenses,
    count: expenses.length,
    total: round2(expenses.reduce((s, e) => s + e.amount, 0)),
    currencies,
  }
}
