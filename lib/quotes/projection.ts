import {
  roundMoney,
  type PublicQuote,
  type PublicQuoteAcceptance,
  type PublicQuoteItem,
  type PublicQuoteState,
  type QuoteLineItem,
  type QuoteScope,
  type QuoteStatus,
} from '@/lib/types'

/**
 * Pure builder for the client-safe PublicQuote. Kept free of I/O so it can be
 * unit-tested against a row stuffed with internal fields.
 *
 * LEAK GUARD: every output field is assigned by name from a named input. Never
 * spread a DB row or a Quote into the result. lib/quotes/projection.test.ts
 * pins the exact key sets, so adding a field means updating that allowlist.
 */

/** The only columns the public paths ever select from quotes. */
export const PROPOSAL_QUOTE_COLUMNS = [
  'id',
  'quote_number',
  'status',
  'title',
  'summary',
  'issue_date',
  'valid_until',
  'estimated_timeline',
  'line_items',
  'scope',
  'vat_rate',
  'payment_terms',
  'notes',
  'version',
  'updated_at',
  'deleted_at',
  'public_token',
].join(', ')

/** The row shape the public paths load. Extra keys are ignored by the builder. */
export interface ProposalRow {
  quote_number: string
  status: QuoteStatus
  title: string
  summary: string | null
  issue_date: string
  valid_until: string | null
  estimated_timeline: string | null
  line_items: QuoteLineItem[] | null
  scope: QuoteScope[] | null
  vat_rate: number | string | null
  payment_terms: string | null
  notes: string | null
  version: number | null
  updated_at: string
  account_name: string | null
  contact_name: string | null
  contact_company: string | null
  acceptance: {
    signer_name: string
    accepted_at: string
    selected_line_item_ids: unknown
    total: number | string
  } | null
}

export interface ProposalCompany {
  name: string
  number: string | null
  email: string | null
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** "3. Job scheduling (included)" → "Job scheduling". The card shows its own number and badge. */
export function cleanItemTitle(raw: string): string {
  const cleaned = raw
    .replace(/^\s*\d+\s*[.)]\s+/, '')
    .replace(/\s*\(included\)\s*$/i, '')
    .trim()
  return cleaned || raw.trim()
}

function cleanDuration(value: string | null | undefined): string | null {
  const duration = text(value)
  if (!duration || duration.toLowerCase() === 'tbc') return null
  return duration
}

/** The scope phase describing a line item: linked by id, else exact phase name. */
export function findScope(item: QuoteLineItem, scope: QuoteScope[]): QuoteScope | undefined {
  return (
    scope.find((phase) => phase.line_item_id === item.id) ??
    scope.find((phase) => !phase.line_item_id && phase.phase === item.description) ??
    scope.find((phase) => phase.phase === item.description)
  )
}

export function buildPublicItems(lineItems: QuoteLineItem[], scope: QuoteScope[]): PublicQuoteItem[] {
  return lineItems.map((item): PublicQuoteItem => {
    const phase = findScope(item, scope)
    const qty = Number(item.qty) || 0
    const unitPrice = Number(item.unit_price) || 0
    const lineTotal = roundMoney(qty * unitPrice)
    const included = lineTotal === 0
    const optional = !included && item.optional === true
    const deliverables = Array.isArray(phase?.deliverables)
      ? phase.deliverables.filter((d): d is string => typeof d === 'string').map((d) => d.trim()).filter(Boolean)
      : []
    return {
      id: String(item.id),
      title: cleanItemTitle(String(item.description ?? '')),
      detail: text(item.detail) ?? text(phase?.description) ?? null,
      qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      optional,
      default_selected: optional ? item.default_selected !== false : true,
      included,
      duration: cleanDuration(phase?.duration),
      deliverables,
    }
  })
}

/** Today's date (YYYY-MM-DD) in Europe/London. */
export function londonToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
}

export function proposalState(
  status: QuoteStatus,
  validUntil: string | null,
  today: string
): PublicQuoteState {
  if (status === 'accepted' || status === 'converted') return 'accepted'
  if (status === 'declined' || status === 'rejected') return 'declined'
  if (status === 'expired') return 'expired'
  if (status === 'sent' && validUntil && validUntil.slice(0, 10) < today) return 'expired'
  if (status === 'sent') return 'open'
  return 'unavailable'
}

function buildAcceptance(row: ProposalRow['acceptance']): PublicQuoteAcceptance | null {
  if (!row) return null
  const ids = Array.isArray(row.selected_line_item_ids)
    ? row.selected_line_item_ids.filter((id): id is string => typeof id === 'string')
    : []
  return {
    signer_name: row.signer_name,
    accepted_at: row.accepted_at,
    selected_line_item_ids: ids,
    total: Number(row.total) || 0,
  }
}

export function buildPublicQuote(row: ProposalRow, company: ProposalCompany, today: string): PublicQuote {
  const contactFirst = text(row.contact_name)?.split(/\s+/)[0] ?? null
  return {
    quote_number: row.quote_number,
    version: Number(row.version) || 1,
    updated_at: row.updated_at,
    title: row.title,
    summary: text(row.summary),
    issue_date: row.issue_date,
    valid_until: row.valid_until ? row.valid_until.slice(0, 10) : null,
    estimated_timeline: text(row.estimated_timeline),
    prepared_for: {
      company: text(row.account_name) ?? text(row.contact_company),
      contact_first_name: contactFirst,
    },
    items: buildPublicItems(row.line_items ?? [], row.scope ?? []),
    vat_rate: Number(row.vat_rate) || 0,
    payment_terms: text(row.payment_terms),
    client_notes: text(row.notes),
    state: proposalState(row.status, row.valid_until, today),
    acceptance: buildAcceptance(row.acceptance),
    company: { name: company.name, number: company.number, email: company.email },
  }
}

/** 256-bit base64url token: exactly 43 characters. Checked before any query. */
export const PROPOSAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function isProposalToken(token: unknown): token is string {
  return typeof token === 'string' && PROPOSAL_TOKEN_PATTERN.test(token)
}
