import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { logQuoteEvent } from '@/lib/quotes/events'
import { notifyRob, osQuotePath } from '@/lib/quotes/notify'
import { jsonError, limitOrNull, proposalNotFound, readJson } from '@/lib/quotes/proposal-api'
import { getProposalContextByToken } from '@/lib/quotes/public'
import { supabaseService } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const REASONS = { price: 'Price', timing: 'Timing', scope: 'Scope', other: 'Other' } as const

const DeclineBody = z.object({
  reason: z.enum(['price', 'timing', 'scope', 'other']),
  message: z.string().trim().max(2000).optional().nullable(),
})

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limited = limitOrNull(request, 'decline', token, 5, 60 * 60 * 1000)
  if (limited) return limited

  const ctx = await getProposalContextByToken(token)
  if (!ctx) return proposalNotFound()

  const body = await readJson(request, DeclineBody)
  if (!body.ok) return body.response

  const quote = ctx.publicQuote
  if (quote.state !== 'open') {
    return jsonError('This proposal can no longer be declined online.', 409, { state: quote.state })
  }

  const { data: flipped, error } = await supabaseService
    .from('quotes')
    .update({ status: 'declined' })
    .eq('id', ctx.quoteId)
    .eq('status', 'sent')
    .is('deleted_at', null)
    .select('id')
  if (error) {
    console.error('[proposal] decline failed', error.message)
    return jsonError('Something went wrong. Please try again.', 500)
  }
  if (!flipped || flipped.length !== 1) {
    return jsonError('This proposal can no longer be declined online.', 409, { state: quote.state })
  }

  const message = body.data.message || null
  await logQuoteEvent(ctx.quoteId, 'declined', { reason: body.data.reason, message })

  const company = quote.prepared_for.company ?? 'A client'
  after(() =>
    notifyRob({
      subject: `${company} declined ${quote.quote_number}`,
      lines: [
        `${company} declined ${quote.quote_number}, ${quote.title}.`,
        `Reason: ${REASONS[body.data.reason]}`,
        ...(message ? [`Message:\n${message}`] : []),
      ],
      osPath: osQuotePath(ctx.quoteId),
      pushTitle: `${company} declined ${quote.quote_number}`,
      pushBody: `Reason: ${REASONS[body.data.reason]}`,
      tag: `quote:${ctx.quoteId}:declined`,
    })
  )

  return NextResponse.json({ ok: true })
}
