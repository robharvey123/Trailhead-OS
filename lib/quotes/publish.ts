import { randomBytes } from 'node:crypto'
import { supabaseService } from '@/lib/supabase/service'
import type { Quote, QuoteStatus } from '@/lib/types'
import { logQuoteEvent } from '@/lib/quotes/events'
import { buildPublicItems, londonToday } from '@/lib/quotes/projection'
import { getPublicQuoteById } from '@/lib/quotes/public'
import { defaultSelection, selectionTotals } from '@/lib/quotes/selection'
import { appOrigin } from '@/lib/site'

/**
 * Publishing a quote as a client proposal page, revoking its link, and the
 * manual acceptance record. Shared by the OS routes, the record email and the
 * MCP/Cowork tools (Phase 6), so the completeness gate is one function.
 *
 * Writes use the service-role client: callers authorise first (OS routes check
 * the session can read the quote through RLS; Cowork is API-key authed).
 */

export function proposalUrl(token: string): string {
  return `${appOrigin()}/proposal/${token}`
}

const PUBLISHABLE: readonly QuoteStatus[] = ['draft', 'review', 'sent']

type GateQuote = Pick<Quote, 'status' | 'account_id' | 'contact_id' | 'line_items' | 'scope' | 'valid_until' | 'summary'>

const PLACEHOLDER = /\b(TBC|TODO)\b/i

/** Every reason this quote cannot be published yet, in plain English. Empty = ready. */
export function publishGateFailures(quote: GateQuote, today: string = londonToday()): string[] {
  const failures: string[] = []
  if (!PUBLISHABLE.includes(quote.status)) {
    failures.push(`It is ${quote.status}. Only draft, review or sent quotes can be published.`)
  }
  if (!quote.account_id && !quote.contact_id) failures.push('Add an account or a contact.')

  const items = buildPublicItems(quote.line_items ?? [], quote.scope ?? [])
  if (!items.some((item) => item.line_total > 0)) failures.push('Add at least one line item priced above zero.')

  if (!quote.valid_until) failures.push('Set a "valid until" date.')
  else if (quote.valid_until.slice(0, 10) < today) failures.push('The "valid until" date has passed. Move it into the future.')

  const placeholders = (quote.line_items ?? [])
    .filter((raw, index) => PLACEHOLDER.test(raw.description) || PLACEHOLDER.test(items[index]?.detail ?? ''))
    .map((raw) => `"${raw.description}"`)
  if (placeholders.length > 0) {
    failures.push(`Replace TBC or TODO in ${placeholders.join(', ')} (title or client description).`)
  }

  if (!quote.summary || !quote.summary.trim()) failures.push('Write a summary. It is the first paragraph the client reads.')
  return failures
}

export type PublishResult =
  | { ok: true; public_url: string; token: string; already: boolean }
  | { ok: false; failures: string[] }

/**
 * Publish: run the gate, mint a 256-bit token unless one exists (or
 * regenerate is asked), stamp published_at, move draft/review to sent with
 * sent_at, and log 'published'. Idempotent for an already published quote.
 */
export async function publishQuote(quoteId: string, options: { regenerate?: boolean } = {}): Promise<PublishResult> {
  const { data, error } = await supabaseService
    .from('quotes')
    .select('id, status, account_id, contact_id, line_items, scope, valid_until, summary, public_token, sent_at')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load quote')
  if (!data) return { ok: false, failures: ['Quote not found.'] }

  const quote = data as GateQuote & { id: string; public_token: string | null; sent_at: string | null }
  const failures = publishGateFailures(quote)
  if (failures.length > 0) return { ok: false, failures }

  if (quote.public_token && !options.regenerate) {
    return { ok: true, public_url: proposalUrl(quote.public_token), token: quote.public_token, already: true }
  }

  const token = randomBytes(32).toString('base64url')
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { public_token: token, published_at: now }
  if (quote.status !== 'sent') patch.status = 'sent'
  if (!quote.sent_at) patch.sent_at = now

  const { error: updateError } = await supabaseService.from('quotes').update(patch).eq('id', quoteId)
  if (updateError) throw new Error(updateError.message || 'Failed to publish quote')

  await logQuoteEvent(quoteId, 'published', { regenerated: Boolean(quote.public_token) })
  return { ok: true, public_url: proposalUrl(token), token, already: false }
}

/** Kill the public link. The page then answers with the same 404 as any bad token. */
export async function revokeQuoteLink(quoteId: string): Promise<{ revoked: boolean }> {
  const { data, error } = await supabaseService
    .from('quotes')
    .update({ public_token: null, published_at: null })
    .eq('id', quoteId)
    .not('public_token', 'is', null)
    .select('id')
  if (error) throw new Error(error.message || 'Failed to revoke link')
  const revoked = Boolean(data && data.length > 0)
  if (revoked) await logQuoteEvent(quoteId, 'revoked')
  return { revoked }
}

/**
 * The OS "Mark as accepted" (and any status change to accepted outside the
 * client page) records the same quote_acceptances row an online accept does:
 * signer = the quote's contact, every default-selected item, meta.manual.
 * No-op when an acceptance already exists, so it is safe to call after any
 * accepted transition.
 */
export async function ensureManualAcceptance(quoteId: string, recordedBy: string | null = null): Promise<void> {
  const { data: existing } = await supabaseService.from('quote_acceptances').select('id').eq('quote_id', quoteId).maybeSingle()
  if (existing) return

  const ctx = await getPublicQuoteById(quoteId)
  if (!ctx) return
  const { publicQuote: quote } = ctx

  const { data: contactRow } = await supabaseService
    .from('quotes')
    .select('contacts(name, email)')
    .eq('id', quoteId)
    .maybeSingle()
  const contactRel = (contactRow as { contacts?: unknown } | null)?.contacts
  const contact = (Array.isArray(contactRel) ? contactRel[0] : contactRel) as { name?: string | null; email?: string | null } | null

  const totals = selectionTotals(quote.items, defaultSelection(quote.items), quote.vat_rate)
  const meta = { manual: true, recorded_by: recordedBy }
  const { error } = await supabaseService.from('quote_acceptances').insert({
    quote_id: quoteId,
    quote_version: quote.version,
    quote_updated_at: quote.updated_at,
    signer_name: contact?.name?.trim() || quote.prepared_for.company || 'Recorded manually',
    signer_email: contact?.email?.trim() || 'not recorded',
    signer_role: null,
    selected_line_item_ids: totals.counted_ids,
    snapshot: {
      quote,
      selected_line_item_ids: totals.counted_ids,
      totals: { subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total },
    },
    subtotal: totals.subtotal,
    vat_amount: totals.vat_amount,
    total: totals.total,
    meta,
  })
  // 23505: a concurrent online accept won the race; its row stands.
  if (error && error.code !== '23505') {
    console.error('[quotes] manual acceptance insert failed', quoteId, error.message)
    return
  }
  if (!error) await logQuoteEvent(quoteId, 'accepted', { ...meta, total: totals.total, items: totals.counted_ids.length })
}

export interface AcceptedSelection {
  ids: Set<string>
  subtotal: number
  vat_amount: number
  total: number
}

/** The accepted selection, when an acceptance row exists. Convert and project read this. */
export async function getAcceptedSelection(quoteId: string): Promise<AcceptedSelection | null> {
  const { data } = await supabaseService
    .from('quote_acceptances')
    .select('selected_line_item_ids, subtotal, vat_amount, total')
    .eq('quote_id', quoteId)
    .maybeSingle()
  if (!data) return null
  const ids = Array.isArray(data.selected_line_item_ids)
    ? (data.selected_line_item_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : []
  return { ids: new Set(ids), subtotal: Number(data.subtotal), vat_amount: Number(data.vat_amount), total: Number(data.total) }
}
