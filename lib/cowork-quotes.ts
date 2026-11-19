import { supabaseService } from '@/lib/supabase/service'
import type { createClient as createServerClient } from '@/lib/supabase/server'
import {
  CoworkApiError,
  findAccountByExactName,
  findContactByName,
  getWorkstreamBySlug,
  isUuid,
  noRecognisedFieldsError,
  optionalDate,
  optionalLinkedId,
  optionalString,
  parseVatRate,
  todayDate,
} from '@/lib/cowork-api'
import {
  calculateTotals,
  createQuote,
  getQuoteById,
  getQuotes,
  softDeleteQuote,
  updateQuote,
} from '@/lib/db/quotes'
import { formatMoney } from '@/lib/money'
import { pickLineItemExtras, pickScopeLink } from '@/lib/quotes/line-item-fields'
import {
  roundMoney,
  type PricingType,
  type Quote,
  type QuoteLineItem,
  type QuoteListItem,
  type QuoteScope,
  type QuoteStatus,
} from '@/lib/types'

/**
 * Quote logic shared by the Cowork REST routes (app/api/cowork/quotes/*) and the
 * MCP tools (lib/mcp/tools.ts) so the two can't drift. Audit logging stays at the
 * call site; the summary builders below are shared so both log the same sentence.
 *
 * Validation here is STRICT (a bad row is a 400 naming the row and field). The
 * session-authenticated UI routes under app/api/quotes keep their own lenient
 * sanitisers, which silently drop malformed rows; the two behaviours differ on
 * purpose and are not shared.
 */

// The lib/db helpers take the cookie-scoped client type; Cowork has no session,
// so it hands them the service client. Same documented cast as lib/mcp/tools.ts.
type DbClient = Awaited<ReturnType<typeof createServerClient>>
const db = supabaseService as unknown as DbClient

const APP_URL = 'https://app.trailheadholdings.uk'

/** Mirrors the live quotes_status_check constraint (migration 20260331153000). */
export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'draft', 'review', 'sent', 'accepted', 'rejected', 'declined', 'expired', 'converted',
]
/** Statuses a quote may be created with through the connector. */
export const QUOTE_CREATE_STATUSES = ['draft', 'review'] as const
/** Statuses update_quote may set. `converted` only happens via the convert route. */
export const QUOTE_UPDATE_STATUSES = QUOTE_STATUSES.filter((s) => s !== 'converted') as Exclude<QuoteStatus, 'converted'>[]
export const QUOTE_PRICING_TYPES: readonly PricingType[] = ['fixed', 'time_and_materials', 'milestone']
export const QUOTE_LINE_ITEM_TYPES: readonly QuoteLineItem['type'][] = ['fixed', 'hourly', 'milestone']

/** Fields update accepts (plus the item lists). Quoted back on a no-recognised-fields 400. */
export const QUOTE_PATCH_FIELDS = [
  'title', 'account_name', 'contact_name', 'workstream', 'project_id', 'summary',
  'items', 'line_items', 'scope', 'pricing_type', 'vat_rate', 'issue_date', 'valid_until',
  'payment_terms', 'notes', 'estimated_timeline', 'status',
]
/** Fields that accept null on update to clear them. */
const CLEARABLE = new Set([
  'account_name', 'contact_name', 'workstream', 'project_id', 'valid_until', 'summary', 'notes', 'estimated_timeline',
])

// ── Output shapes ────────────────────────────────────────────────────────────

export interface FormattedQuoteLineItem {
  id: string
  description: string
  qty: number
  unit_price: number
  type: QuoteLineItem['type']
  line_total: number
  optional?: boolean
  default_selected?: boolean
  detail?: string
}

export interface FormattedQuoteBase {
  id: string
  quote_number: string
  title: string
  status: QuoteStatus
  pricing_type: PricingType
  account: { id: string; name: string } | null
  contact: { id: string; name: string } | null
  workstream: string | null
  project: { id: string; name: string } | null
  summary: string | null
  issue_date: string
  valid_until: string | null
  payment_terms: string | null
  notes: string | null
  estimated_timeline: string | null
  vat_rate: number
  subtotal: number
  vat: number
  total: number
  converted_invoice_id: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  url: string
}

export interface FormattedQuote extends FormattedQuoteBase {
  line_items: FormattedQuoteLineItem[]
  scope: QuoteScope[]
}

export interface FormattedQuoteSummary extends FormattedQuoteBase {
  line_item_count: number
}

function formatBase(quote: QuoteListItem): FormattedQuoteBase {
  const vatRate = Number(quote.vat_rate ?? 0)
  const totals = calculateTotals(quote.line_items ?? [], vatRate)
  return {
    id: quote.id,
    quote_number: quote.quote_number,
    title: quote.title,
    status: quote.status,
    pricing_type: quote.pricing_type,
    account: quote.account ? { id: quote.account.id, name: quote.account.name } : null,
    contact: quote.contact ? { id: quote.contact.id, name: quote.contact.name } : null,
    workstream: quote.workstream?.slug ?? null,
    project: quote.project ? { id: quote.project.id, name: quote.project.name } : null,
    summary: quote.summary ?? null,
    issue_date: quote.issue_date,
    valid_until: quote.valid_until ?? null,
    payment_terms: quote.payment_terms ?? null,
    notes: quote.notes ?? null,
    estimated_timeline: quote.estimated_timeline ?? null,
    vat_rate: vatRate,
    subtotal: totals.subtotal,
    vat: totals.vat_amount,
    total: totals.total,
    converted_invoice_id: quote.converted_invoice_id ?? null,
    sent_at: quote.sent_at ?? null,
    created_at: quote.created_at,
    updated_at: quote.updated_at,
    url: `${APP_URL}/quotes/${quote.id}`,
  }
}

export function formatQuote(quote: QuoteListItem): FormattedQuote {
  return {
    ...formatBase(quote),
    line_items: (quote.line_items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      qty: Number(item.qty),
      unit_price: Number(item.unit_price),
      type: item.type ?? 'fixed',
      line_total: roundMoney(Number(item.qty) * Number(item.unit_price)),
      // Re-read through the shared picker so get_quote → update_quote round-trips them.
      ...pickLineItemExtras(item as unknown as Record<string, unknown>),
    })),
    scope: quote.scope ?? [],
  }
}

export function formatQuoteSummary(quote: QuoteListItem): FormattedQuoteSummary {
  return { ...formatBase(quote), line_item_count: (quote.line_items ?? []).length }
}

// ── Strict parsers ───────────────────────────────────────────────────────────

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CoworkApiError(`${label} must be an object`, 400)
  }
  return value as Record<string, unknown>
}

function rowString(record: Record<string, unknown>, field: string, label: string) {
  const value = optionalString(record[field])
  if (!value) throw new CoworkApiError(`${label}: ${field} is required`, 400)
  return value
}

function rowNumber(
  record: Record<string, unknown>,
  field: string,
  label: string,
  opts: { fallback?: number; positive?: boolean }
): number {
  const raw = record[field]
  if (raw === undefined || raw === null || raw === '') {
    if (opts.fallback !== undefined) return opts.fallback
    throw new CoworkApiError(`${label}: ${field} is required`, 400)
  }
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
  if (!Number.isFinite(num)) throw new CoworkApiError(`${label}: ${field} must be a number`, 400)
  if (opts.positive ? num <= 0 : num < 0) {
    throw new CoworkApiError(`${label}: ${field} must be ${opts.positive ? 'greater than zero' : 'zero or greater'}`, 400)
  }
  return num
}

function optionalRowNumber(record: Record<string, unknown>, field: string, label: string) {
  const raw = record[field]
  if (raw === undefined || raw === null || raw === '') return undefined
  return rowNumber(record, field, label, {})
}

function rowDeliverables(record: Record<string, unknown>, label: string): string[] {
  const raw = record.deliverables
  if (raw === undefined || raw === null) return []
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) {
    throw new CoworkApiError(`${label}: deliverables must be an array of strings`, 400)
  }
  return (raw as string[]).map((entry) => entry.trim()).filter(Boolean)
}

function rowLabel(list: string, index: number, record: Record<string, unknown>, nameField: string) {
  const name = optionalString(record[nameField])
  return `${list}[${index}]${name ? ` ("${name}")` : ''}`
}

function requireNonEmptyArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CoworkApiError(`${field} must be an array with at least one row`, 400)
  }
  return value
}

export interface ParsedQuoteItems {
  line_items: QuoteLineItem[]
  scope: QuoteScope[]
}

/** The convenience `items` list → matching line_items and scope, in order. */
export function parseQuoteItems(value: unknown): ParsedQuoteItems {
  const rows = requireNonEmptyArray(value, 'items')
  const line_items: QuoteLineItem[] = []
  const scope: QuoteScope[] = []
  rows.forEach((row, index) => {
    const record = asRecord(row, `items[${index}]`)
    const label = rowLabel('items', index, record, 'title')
    const title = rowString(record, 'title', label)
    const description = rowString(record, 'description', label)
    const price = rowNumber(record, 'price', label, {})
    const qty = rowNumber(record, 'qty', label, { fallback: 1, positive: true })
    const deliverables = rowDeliverables(record, label)
    const duration = optionalString(record.duration) ?? 'TBC'
    const estimatedHours = optionalRowNumber(record, 'estimated_hours', label)

    const id = crypto.randomUUID()
    // `description` here is already client-facing and lands on the scope phase,
    // which the proposal joins by line_item_id. `detail` overrides it on the card.
    line_items.push({ id, description: title, qty, unit_price: price, type: 'fixed', ...pickLineItemExtras(record) })
    const entry: QuoteScope = { phase: title, description, deliverables, duration, line_item_id: id }
    if (estimatedHours !== undefined) entry.estimated_hours = estimatedHours
    scope.push(entry)
  })
  return { line_items, scope }
}

/** Priced rows: { description, qty, unit_price, type? } (type defaults to fixed). */
export function parseQuoteLineItems(value: unknown): QuoteLineItem[] {
  const rows = requireNonEmptyArray(value, 'line_items')
  return rows.map((row, index) => {
    const record = asRecord(row, `line_items[${index}]`)
    const label = rowLabel('line_items', index, record, 'description')
    const description = rowString(record, 'description', label)
    const qty = rowNumber(record, 'qty', label, { fallback: 1, positive: true })
    const unitPrice = rowNumber(record, 'unit_price', label, {})
    const rawType = record.type ?? 'fixed'
    if (typeof rawType !== 'string' || !QUOTE_LINE_ITEM_TYPES.includes(rawType as QuoteLineItem['type'])) {
      throw new CoworkApiError(`${label}: type must be one of ${QUOTE_LINE_ITEM_TYPES.join(', ')}`, 400)
    }
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : crypto.randomUUID()
    return { id, description, qty, unit_price: unitPrice, type: rawType as QuoteLineItem['type'], ...pickLineItemExtras(record) }
  })
}

/** Descriptive scope rows: { phase, description, deliverables?, duration?, estimated_hours? }. An empty array clears the scope. */
export function parseQuoteScope(value: unknown): QuoteScope[] {
  if (!Array.isArray(value)) throw new CoworkApiError('scope must be an array', 400)
  return value.map((row, index) => {
    const record = asRecord(row, `scope[${index}]`)
    const label = rowLabel('scope', index, record, 'phase')
    const entry: QuoteScope = {
      phase: rowString(record, 'phase', label),
      description: rowString(record, 'description', label),
      deliverables: rowDeliverables(record, label),
      duration: optionalString(record.duration) ?? 'TBC',
    }
    const hours = optionalRowNumber(record, 'estimated_hours', label)
    if (hours !== undefined) entry.estimated_hours = hours
    Object.assign(entry, pickScopeLink(record))
    return entry
  })
}

/**
 * Resolve the item fields of a create/update body. `items` fills both lists and
 * cannot be mixed with `line_items` or `scope`. Returns only the lists supplied.
 */
export function parseQuoteItemFields(body: Record<string, unknown>): Partial<ParsedQuoteItems> {
  if (body.items !== undefined) {
    if (body.line_items !== undefined || body.scope !== undefined) {
      throw new CoworkApiError('Supply either items, or line_items and/or scope, not both', 400)
    }
    return parseQuoteItems(body.items)
  }
  const out: Partial<ParsedQuoteItems> = {}
  if (body.line_items !== undefined) out.line_items = parseQuoteLineItems(body.line_items)
  if (body.scope !== undefined) out.scope = parseQuoteScope(body.scope)
  return out
}

function parsePricingType(value: unknown): PricingType {
  if (typeof value !== 'string' || !QUOTE_PRICING_TYPES.includes(value as PricingType)) {
    throw new CoworkApiError(`pricing_type must be one of ${QUOTE_PRICING_TYPES.join(', ')}`, 400)
  }
  return value as PricingType
}

function parseListStatus(value: unknown): QuoteStatus | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !QUOTE_STATUSES.includes(value as QuoteStatus)) {
    throw new CoworkApiError(`status must be one of ${QUOTE_STATUSES.join(', ')}`, 400)
  }
  return value as QuoteStatus
}

function requiredTitle(value: unknown) {
  const title = optionalString(value)
  if (!title) throw new CoworkApiError('title is required', 400)
  return title
}

// ── Lookups ──────────────────────────────────────────────────────────────────

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

/** A quote by uuid or quote number (case-insensitive). Excludes soft-deleted; 404 otherwise. */
export async function getQuoteByRef(ref: string): Promise<QuoteListItem> {
  const trimmed = ref.trim()
  if (!trimmed) throw new CoworkApiError('quote is required', 400)

  let id: string | null = null
  if (isUuid(trimmed)) {
    id = trimmed
  } else {
    const { data, error } = await supabaseService
      .from('quotes')
      .select('id')
      .ilike('quote_number', escapeLike(trimmed))
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (error) throw new CoworkApiError(error.message || 'Failed to load quote', 500)
    id = (data as { id: string } | null)?.id ?? null
  }

  const quote = id ? await getQuoteById(id, db).catch((error: unknown) => {
    throw new CoworkApiError(error instanceof Error ? error.message : 'Failed to load quote', 500)
  }) : null
  if (!quote) throw new CoworkApiError(`Quote not found: ${trimmed}`, 404)
  return quote
}

async function resolveAccount(name: string) {
  const account = await findAccountByExactName(name)
  if (!account) {
    throw new CoworkApiError(`Account not found: ${name}. The name must match an existing sales account exactly; quotes never create accounts.`, 400)
  }
  return { id: account.id, name: account.name }
}

async function resolveContact(name: string) {
  const contact = await findContactByName(escapeLike(name))
  if (!contact || contact.name.trim().toLowerCase() !== name.trim().toLowerCase()) {
    throw new CoworkApiError(`Contact not found: ${name}. The name must match an existing contact exactly.`, 400)
  }
  return contact
}

function db500(error: unknown, fallback: string): never {
  if (error instanceof CoworkApiError) throw error
  throw new CoworkApiError(error instanceof Error ? error.message : fallback, 500)
}

// ── List / create / update / delete ──────────────────────────────────────────

export async function listCoworkQuotes(filters: { status?: unknown; accountName?: string | null; limit?: unknown }) {
  const status = parseListStatus(filters.status)
  let limit = 50
  if (filters.limit !== undefined && filters.limit !== null && filters.limit !== '') {
    const parsed = Number(filters.limit)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
      throw new CoworkApiError('limit must be a positive integer up to 200', 400)
    }
    limit = parsed
  }
  const accountName = optionalString(filters.accountName)
  const account = accountName ? await resolveAccount(accountName) : null

  const quotes = await getQuotes(
    { ...(status ? { status } : {}), ...(account ? { account_id: account.id } : {}) },
    db
  ).catch((error: unknown) => db500(error, 'Failed to load quotes'))
  return quotes.slice(0, limit).map(formatQuoteSummary)
}

export async function createCoworkQuote(body: Record<string, unknown>): Promise<{ quote: FormattedQuote }> {
  const title = requiredTitle(body.title)
  const items = parseQuoteItemFields(body)
  if (!items.line_items || items.line_items.length === 0) {
    throw new CoworkApiError('Supply items or line_items with at least one row', 400)
  }

  const status = body.status === undefined || body.status === null ? 'draft' : body.status
  if (typeof status !== 'string' || !(QUOTE_CREATE_STATUSES as readonly string[]).includes(status)) {
    throw new CoworkApiError('status must be draft or review; a quote cannot be created as sent, accepted or converted', 400)
  }

  const contactName = optionalString(body.contact_name)
  const accountName = optionalString(body.account_name)
  const contact = contactName ? await resolveContact(contactName) : null
  const account = accountName ? await resolveAccount(accountName) : null
  const workstreamSlug = optionalString(body.workstream)
  const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
  const projectId = await optionalLinkedId(body.project_id, 'project_id', 'projects')

  const input: Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'> = {
    title,
    status: status as QuoteStatus,
    pricing_type: body.pricing_type === undefined || body.pricing_type === null ? 'fixed' : parsePricingType(body.pricing_type),
    line_items: items.line_items,
    scope: items.scope ?? [],
    vat_rate: parseVatRate(body.vat_rate, 20),
    issue_date: optionalDate(body.issue_date, 'issue_date') ?? todayDate(),
    version: 1,
    ai_generated: false,
  }
  const accountId = account?.id ?? contact?.account_id ?? null
  if (accountId) input.account_id = accountId
  if (contact) input.contact_id = contact.id
  if (workstream) input.workstream_id = workstream.id
  if (projectId) input.project_id = projectId
  const summary = optionalString(body.summary)
  if (summary) input.summary = summary
  const validUntil = optionalDate(body.valid_until, 'valid_until')
  if (validUntil) input.valid_until = validUntil
  // payment_terms omitted → the column default applies (sanitizeQuotePayload only writes it when present).
  const paymentTerms = optionalString(body.payment_terms)
  if (paymentTerms) input.payment_terms = paymentTerms
  const notes = optionalString(body.notes)
  if (notes) input.notes = notes
  const timeline = optionalString(body.estimated_timeline)
  if (timeline) input.estimated_timeline = timeline

  const created = await createQuote(input, db).catch((error: unknown) => db500(error, 'Failed to create quote'))
  // Re-read so the relations (account, contact, workstream slug) are hydrated the same way as get_quote.
  const quote = await getQuoteByRef(created.id)
  return { quote: formatQuote(quote) }
}

/** A quote patch where clearable fields may be null (sanitizeQuotePayload maps null through). */
type QuotePatch = { [K in keyof Quote]?: Quote[K] | null }

export interface UpdatedQuote {
  quote: FormattedQuote
  /** Prior DB values of only the fields that changed (for the activity log and revert). */
  before: Record<string, unknown>
  /** DB columns that changed. */
  changed: string[]
}

function sameValue(a: unknown, b: unknown) {
  const norm = (v: unknown) => (v === undefined || v === '' ? null : v)
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b))
}

export async function updateCoworkQuote(ref: string, body: Record<string, unknown>): Promise<UpdatedQuote> {
  const supplied = Object.keys(body).filter((key) => key !== 'quote' && key !== 'ref')
  if (supplied.length === 0) throw new CoworkApiError('No changes supplied', 400)
  const recognised = supplied.filter((key) => QUOTE_PATCH_FIELDS.includes(key))
  if (recognised.length === 0) throw noRecognisedFieldsError(body, QUOTE_PATCH_FIELDS)

  const existing = await getQuoteByRef(ref)

  // Converted quotes are locked: only notes may change.
  if (existing.status === 'converted' || existing.converted_invoice_id) {
    const blocked = recognised.filter((key) => key !== 'notes')
    if (blocked.length > 0) {
      const invoiceLabel = existing.invoice?.invoice_number ?? existing.converted_invoice_id ?? 'an invoice'
      throw new CoworkApiError(
        `Quote ${existing.quote_number} has been converted to invoice ${invoiceLabel} and is locked; only notes can change (refused: ${blocked.join(', ')})`,
        409
      )
    }
  }

  for (const key of recognised) {
    if (body[key] === null && !CLEARABLE.has(key)) {
      throw new CoworkApiError(`${key} cannot be cleared`, 400)
    }
  }

  const patch: QuotePatch = {}

  if (body.title !== undefined) patch.title = requiredTitle(body.title)
  if (body.summary !== undefined) patch.summary = optionalString(body.summary)
  if (body.notes !== undefined) patch.notes = optionalString(body.notes)
  if (body.estimated_timeline !== undefined) patch.estimated_timeline = optionalString(body.estimated_timeline)
  if (body.payment_terms !== undefined) {
    const terms = optionalString(body.payment_terms)
    if (!terms) throw new CoworkApiError('payment_terms cannot be empty', 400)
    patch.payment_terms = terms
  }
  if (body.pricing_type !== undefined) patch.pricing_type = parsePricingType(body.pricing_type)
  if (body.vat_rate !== undefined) patch.vat_rate = parseVatRate(body.vat_rate)
  if (body.issue_date !== undefined) {
    const date = optionalDate(body.issue_date, 'issue_date')
    if (!date) throw new CoworkApiError('issue_date cannot be cleared', 400)
    patch.issue_date = date
  }
  if (body.valid_until !== undefined) patch.valid_until = optionalDate(body.valid_until, 'valid_until')
  if (body.project_id !== undefined) patch.project_id = await optionalLinkedId(body.project_id, 'project_id', 'projects')
  if (body.workstream !== undefined) {
    const slug = optionalString(body.workstream)
    patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }
  if (body.account_name !== undefined) {
    const name = optionalString(body.account_name)
    patch.account_id = name ? (await resolveAccount(name)).id : null
  }
  if (body.contact_name !== undefined) {
    const name = optionalString(body.contact_name)
    if (name) {
      const contact = await resolveContact(name)
      patch.contact_id = contact.id
      if (body.account_name === undefined && !existing.account_id && contact.account_id) {
        patch.account_id = contact.account_id
      }
    } else {
      patch.contact_id = null
    }
  }

  const items = parseQuoteItemFields(body)
  if (items.line_items) patch.line_items = items.line_items
  if (items.scope) patch.scope = items.scope

  if (body.status !== undefined) {
    if (body.status === 'converted') {
      throw new CoworkApiError('status cannot be set to converted here; convert the quote to an invoice from the quote page in the OS', 400)
    }
    if (typeof body.status !== 'string' || !(QUOTE_UPDATE_STATUSES as string[]).includes(body.status)) {
      throw new CoworkApiError(`status must be one of ${QUOTE_UPDATE_STATUSES.join(', ')}`, 400)
    }
    patch.status = body.status as QuoteStatus
    if (body.status === 'sent' && !existing.sent_at) patch.sent_at = new Date().toISOString()
  }

  // Keep only real changes, and capture their prior values.
  const before: Record<string, unknown> = {}
  const changed: string[] = []
  const existingRecord = existing as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(patch)) {
    if (sameValue(existingRecord[key], value)) {
      delete (patch as Record<string, unknown>)[key]
    } else {
      before[key] = existingRecord[key] ?? null
      changed.push(key)
    }
  }

  if (changed.length === 0) {
    return { quote: formatQuote(existing), before, changed }
  }

  // Single documented cast: QuotePatch allows null on clearable columns, which
  // sanitizeQuotePayload maps through as null.
  await updateQuote(existing.id, patch as Partial<Quote>, db).catch((error: unknown) => db500(error, 'Failed to update quote'))
  const quote = await getQuoteByRef(existing.id)
  return { quote: formatQuote(quote), before, changed }
}

export async function deleteCoworkQuote(ref: string): Promise<{ quote: FormattedQuote }> {
  const existing = await getQuoteByRef(ref) // 404 on unknown / already deleted
  if (existing.status === 'accepted' || existing.status === 'converted' || existing.converted_invoice_id) {
    throw new CoworkApiError(
      `Quote ${existing.quote_number} is ${existing.converted_invoice_id && existing.status !== 'converted' ? 'linked to an invoice' : existing.status} and cannot be deleted; set its status to declined or expired instead.`,
      409
    )
  }
  await softDeleteQuote(existing.id, db).catch((error: unknown) => db500(error, 'Failed to delete quote'))
  return { quote: formatQuote(existing) }
}

// ── Activity-log sentences (shared by the MCP tools and REST routes) ─────────

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`

export function quoteCreatedSummary(quote: FormattedQuote) {
  return `Created ${quote.status} quote ${quote.quote_number}, ${formatMoney(quote.subtotal)} ex VAT, ${plural(quote.line_items.length, 'item')}${quote.account ? `, ${quote.account.name}` : ''} (${quote.title})`
}

export function quoteUpdatedSummary(quote: FormattedQuote, before: Record<string, unknown>, changed: string[]) {
  const parts: string[] = []
  if (changed.includes('status')) parts.push(`status ${String(before.status)} to ${quote.status}`)
  const lines = changed.includes('line_items')
  const scope = changed.includes('scope')
  if (lines) {
    parts.push(`${scope ? 'line items and scope' : 'line items'} replaced (${plural(quote.line_items.length, 'item')}, ${formatMoney(quote.subtotal)} ex VAT)`)
  } else if (scope) {
    parts.push(`scope replaced (${plural(quote.scope.length, 'entry', 'entries')})`)
  }
  const others = changed.filter((key) => !['status', 'line_items', 'scope', 'sent_at'].includes(key))
  if (others.length) parts.push(`${others.join(', ')} changed`)
  return `Updated quote ${quote.quote_number}: ${parts.join('; ')}`
}

export function quoteDeletedSummary(quote: FormattedQuote) {
  return `Deleted ${quote.status} quote ${quote.quote_number}${quote.account ? `, ${quote.account.name}` : ''} (soft delete)`
}
