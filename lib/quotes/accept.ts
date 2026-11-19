import { supabaseService } from '@/lib/supabase/service'
import type { PublicQuote, PublicQuoteAcceptance } from '@/lib/types'
import { logQuoteEvent } from '@/lib/quotes/events'
import { selectionTotals, type SelectionTotals } from '@/lib/quotes/selection'

/**
 * Record an acceptance: the one path for both the client's online accept and
 * Rob's manual "Mark as accepted" in the OS (Phase 5), so downstream logic
 * (convert, project, reporting) only ever reads quote_acceptances.
 *
 * quotes.line_items is never touched: the acceptance row is the record of
 * what was chosen, and its snapshot is the PublicQuote exactly as shown.
 */

export type AcceptResult =
  | { ok: true; acceptance: PublicQuoteAcceptance; totals: SelectionTotals }
  | { ok: false; status: 400 | 409 | 500; error: string; state?: PublicQuote['state'] }

export interface AcceptInput {
  quoteId: string
  quote: PublicQuote
  signer: { name: string; email: string; role: string | null }
  /** Optional ids the client switched on. Required and included are added here. */
  selectedIds: string[]
  /** updated_at the client saw. Must still match, so edited prices cannot be accepted. */
  seenUpdatedAt: string
  /** Statuses the flip may start from. Online accept: only 'sent'. */
  fromStatuses: readonly string[]
  ip: string | null
  userAgent: string | null
  meta?: Record<string, unknown>
}

function sameInstant(a: string, b: string): boolean {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return Number.isFinite(ta) && ta === tb
}

export async function recordAcceptance(input: AcceptInput): Promise<AcceptResult> {
  const { quote } = input

  if (!sameInstant(input.seenUpdatedAt, quote.updated_at)) {
    return { ok: false, status: 409, error: 'This proposal was updated. Refresh to see the latest version.', state: quote.state }
  }

  const known = new Set(quote.items.map((item) => item.id))
  const unknown = input.selectedIds.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    return { ok: false, status: 400, error: 'Your selection includes a feature that is not on this proposal. Refresh and try again.' }
  }

  const totals = selectionTotals(quote.items, input.selectedIds, quote.vat_rate)
  if (totals.priced_count === 0) {
    return { ok: false, status: 400, error: 'Choose at least one feature before accepting.' }
  }

  // Atomic flip. Guarding on updated_at as well closes the gap between the
  // freshness check above and this write: an edit in between makes it match 0 rows.
  const { data: flipped, error: flipError } = await supabaseService
    .from('quotes')
    .update({ status: 'accepted' })
    .eq('id', input.quoteId)
    .in('status', [...input.fromStatuses])
    .eq('updated_at', quote.updated_at)
    .is('deleted_at', null)
    .select('id')
  if (flipError) {
    console.error('[proposal] accept flip failed', flipError.message)
    return { ok: false, status: 500, error: 'Something went wrong. Please try again.' }
  }
  if (!flipped || flipped.length !== 1) {
    return { ok: false, status: 409, error: 'This proposal can no longer be accepted. Refresh to see its current status.', state: quote.state }
  }

  const acceptedAt = new Date().toISOString()
  const snapshot = {
    quote,
    selected_line_item_ids: totals.counted_ids,
    totals: { subtotal: totals.subtotal, vat_amount: totals.vat_amount, total: totals.total },
  }
  const { error: insertError } = await supabaseService.from('quote_acceptances').insert({
    quote_id: input.quoteId,
    quote_version: quote.version,
    quote_updated_at: quote.updated_at,
    signer_name: input.signer.name,
    signer_email: input.signer.email,
    signer_role: input.signer.role,
    selected_line_item_ids: totals.counted_ids,
    snapshot,
    subtotal: totals.subtotal,
    vat_amount: totals.vat_amount,
    total: totals.total,
    ip: input.ip,
    user_agent: input.userAgent,
    meta: input.meta ?? {},
    accepted_at: acceptedAt,
  })

  if (insertError) {
    // Never leave an accepted quote with no acceptance row.
    console.error('[proposal] acceptance insert failed, reverting status', insertError.message)
    const { error: revertError } = await supabaseService
      .from('quotes')
      .update({ status: input.fromStatuses[0] ?? 'sent' })
      .eq('id', input.quoteId)
      .eq('status', 'accepted')
    if (revertError) console.error('[proposal] REVERT FAILED, quote accepted without acceptance row', input.quoteId, revertError.message)
    return { ok: false, status: 500, error: 'Something went wrong. Please try again.' }
  }

  await logQuoteEvent(input.quoteId, 'accepted', {
    signer_name: input.signer.name,
    total: totals.total,
    items: totals.counted_ids.length,
    ...(input.meta ?? {}),
  })

  return {
    ok: true,
    totals,
    acceptance: {
      signer_name: input.signer.name,
      accepted_at: acceptedAt,
      selected_line_item_ids: totals.counted_ids,
      total: totals.total,
    },
  }
}
