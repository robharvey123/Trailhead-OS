import { createHash } from 'node:crypto'
import { supabaseService } from '@/lib/supabase/service'
import type { QuoteEventType } from '@/lib/types'
import { notifyRob, osQuotePath } from '@/lib/quotes/notify'

/** Server-only writes to the quote activity trail (service role). */

export async function logQuoteEvent(quoteId: string, type: QuoteEventType, meta: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseService.from('quote_events').insert({ quote_id: quoteId, type, meta })
  if (error) console.error(`[proposal] failed to log ${type} event`, error.message)
}

/** sha256(ip + token): stable per visitor per link, never the raw IP. */
export function viewerHash(ip: string, token: string): string {
  return createHash('sha256').update(`${ip}${token}`).digest('hex')
}

const VIEW_DEDUPE_MS = 30 * 60 * 1000

/**
 * Record one client view. Skipped when the same viewer (ip_hash) viewed this
 * quote in the last 30 minutes. view_count is re-derived from the events, so it
 * self-corrects under concurrent views. The first ever view is detected with a
 * conditional update on first_viewed_at, so exactly one request sends the
 * "just opened" notice.
 *
 * The caller decides who counts: logged-in OS users are skipped before this.
 */
export async function recordProposalView(input: {
  quoteId: string
  token: string
  ip: string
  quoteNumber: string
  company: string | null
}): Promise<void> {
  try {
    const ipHash = viewerHash(input.ip, input.token)
    const since = new Date(Date.now() - VIEW_DEDUPE_MS).toISOString()

    const { data: recent } = await supabaseService
      .from('quote_events')
      .select('id')
      .eq('quote_id', input.quoteId)
      .eq('type', 'viewed')
      .eq('meta->>ip_hash', ipHash)
      .gte('created_at', since)
      .limit(1)
    if (recent && recent.length > 0) return

    await logQuoteEvent(input.quoteId, 'viewed', { ip_hash: ipHash })

    const now = new Date().toISOString()
    const { count } = await supabaseService
      .from('quote_events')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', input.quoteId)
      .eq('type', 'viewed')
    await supabaseService
      .from('quotes')
      .update({ view_count: count ?? 1, last_viewed_at: now })
      .eq('id', input.quoteId)

    const { data: first } = await supabaseService
      .from('quotes')
      .update({ first_viewed_at: now })
      .eq('id', input.quoteId)
      .is('first_viewed_at', null)
      .select('id')
    if (first && first.length > 0) {
      const who = input.company ?? 'A client'
      await notifyRob({
        subject: `${who} just opened ${input.quoteNumber}`,
        lines: [`${who} just opened proposal ${input.quoteNumber} for the first time.`],
        osPath: osQuotePath(input.quoteId),
        pushTitle: `${who} opened ${input.quoteNumber}`,
        pushBody: 'First view of the proposal page',
        tag: `quote:${input.quoteId}:opened`,
      })
    }
  } catch (err) {
    console.error('[proposal] view logging failed', err)
  }
}
