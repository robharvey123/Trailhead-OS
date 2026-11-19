import { COMPANY } from '@/lib/brand'
import { getCompanySettings } from '@/lib/company-settings'
import { supabaseService } from '@/lib/supabase/service'
import type { PublicQuote, QuoteStatus } from '@/lib/types'
import {
  PROPOSAL_QUOTE_COLUMNS,
  buildPublicQuote,
  isProposalToken,
  londonToday,
  type ProposalCompany,
  type ProposalRow,
} from '@/lib/quotes/projection'

export { selectionTotals } from '@/lib/quotes/selection'

/**
 * Server-only reads for the public proposal surface. Uses the service-role
 * client, so it must never be imported into a client component: the guard
 * below throws if it is ever bundled for the browser (the `server-only`
 * package is not installed in this repo).
 *
 * Public access is service-role only, through here. There is no anon RLS
 * policy on quotes, quote_acceptances or quote_events.
 */
if (typeof window !== 'undefined') {
  throw new Error('lib/quotes/public.ts is server-only')
}

const SELECT = `${PROPOSAL_QUOTE_COLUMNS}, accounts(name), contacts(name, company), quote_acceptances(signer_name, accepted_at, selected_line_item_ids, total)`

type RawRow = Record<string, unknown> & {
  id: string
  status: QuoteStatus
  deleted_at: string | null
  public_token: string | null
}

/** Internal context for the /api/proposal handlers. Never sent to the browser. */
export interface ProposalContext {
  quoteId: string
  status: QuoteStatus
  publicQuote: PublicQuote
}

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null
  return (value as T | null) ?? null
}

async function proposalCompany(): Promise<ProposalCompany> {
  const settings = await getCompanySettings(supabaseService)
  return {
    name: settings.company_name || COMPANY.name,
    number: settings.company_number ?? COMPANY.number,
    // Proposals come from Rob: the brand module's address, not the settings
    // row (which still carries the old info@ mailbox).
    email: COMPANY.email,
  }
}

function toProposalRow(raw: RawRow): ProposalRow {
  const account = one<{ name: string | null }>(raw.accounts)
  const contact = one<{ name: string | null; company: string | null }>(raw.contacts)
  const acceptance = one<NonNullable<ProposalRow['acceptance']>>(raw.quote_acceptances)
  return {
    quote_number: raw.quote_number as string,
    status: raw.status,
    title: raw.title as string,
    summary: (raw.summary as string | null) ?? null,
    issue_date: raw.issue_date as string,
    valid_until: (raw.valid_until as string | null) ?? null,
    estimated_timeline: (raw.estimated_timeline as string | null) ?? null,
    line_items: (raw.line_items as ProposalRow['line_items']) ?? [],
    scope: (raw.scope as ProposalRow['scope']) ?? [],
    vat_rate: (raw.vat_rate as number | string | null) ?? 0,
    payment_terms: (raw.payment_terms as string | null) ?? null,
    notes: (raw.notes as string | null) ?? null,
    version: (raw.version as number | null) ?? 1,
    updated_at: raw.updated_at as string,
    account_name: account?.name ?? null,
    contact_name: contact?.name ?? null,
    contact_company: contact?.company ?? null,
    acceptance,
  }
}

async function buildContext(raw: RawRow): Promise<ProposalContext> {
  const publicQuote = buildPublicQuote(toProposalRow(raw), await proposalCompany(), londonToday())
  return { quoteId: raw.id, status: raw.status, publicQuote }
}

/**
 * Token lookup with every public gate applied. Returns null, never throws, for
 * a missing, malformed, unknown or revoked token, a soft-deleted quote, or a
 * draft/review quote, so every failure looks the same to the caller.
 */
export async function getProposalContextByToken(token: string | null | undefined): Promise<ProposalContext | null> {
  if (!isProposalToken(token)) return null
  const { data, error } = await supabaseService
    .from('quotes')
    .select(SELECT)
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    console.error('[proposal] token lookup failed', error.message)
    return null
  }
  const raw = data as unknown as RawRow | null
  if (!raw || raw.public_token !== token) return null
  if (raw.status === 'draft' || raw.status === 'review') return null
  return buildContext(raw)
}

export async function getPublicQuoteByToken(token: string | null | undefined): Promise<PublicQuote | null> {
  return (await getProposalContextByToken(token))?.publicQuote ?? null
}

/**
 * INTERNAL: the same projection by quote id, with no status gate, for the
 * authed OS PDF download and the client preview. Never call this from a public
 * route: it ignores publish state.
 */
export async function getPublicQuoteById(id: string): Promise<ProposalContext | null> {
  const { data, error } = await supabaseService
    .from('quotes')
    .select(SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load quote')
  return data ? buildContext(data as unknown as RawRow) : null
}
