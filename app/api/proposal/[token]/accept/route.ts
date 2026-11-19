import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { recordAcceptance } from '@/lib/quotes/accept'
import { chosenTitles, sendSignerConfirmation } from '@/lib/quotes/emails'
import { gbp } from '@/lib/quotes/format'
import { notifyRob, osQuotePath } from '@/lib/quotes/notify'
import { jsonError, limitOrNull, proposalNotFound, readJson, requestMeta } from '@/lib/quotes/proposal-api'
import { getProposalContextByToken } from '@/lib/quotes/public'
import { appOrigin } from '@/lib/site'

export const runtime = 'nodejs'

const AcceptBody = z.object({
  signer_name: z.string().trim().min(2, 'Enter your full name').max(120),
  signer_email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  signer_role: z.string().trim().max(120).optional().nullable(),
  selected_line_item_ids: z.array(z.string().max(100)).max(200),
  seen_updated_at: z.string().min(1).max(64),
  confirm: z.literal(true, { message: 'Confirm you are authorised to accept' }),
})

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limited = limitOrNull(request, 'accept', token, 5, 10 * 60 * 1000)
  if (limited) return limited

  const ctx = await getProposalContextByToken(token)
  if (!ctx) return proposalNotFound()

  const body = await readJson(request, AcceptBody)
  if (!body.ok) return body.response

  const { publicQuote: quote } = ctx
  if (quote.state !== 'open') {
    return jsonError('This proposal can no longer be accepted online.', 409, { state: quote.state })
  }

  const meta = requestMeta(request)
  const result = await recordAcceptance({
    quoteId: ctx.quoteId,
    quote,
    signer: { name: body.data.signer_name, email: body.data.signer_email, role: body.data.signer_role || null },
    selectedIds: body.data.selected_line_item_ids,
    seenUpdatedAt: body.data.seen_updated_at,
    fromStatuses: ['sent'],
    ip: meta.ip,
    userAgent: meta.user_agent,
  })
  if (!result.ok) return jsonError(result.error, result.status, result.state ? { state: result.state } : {})

  const { acceptance, totals } = result
  const company = quote.prepared_for.company ?? 'A client'
  const titles = chosenTitles(quote, acceptance.selected_line_item_ids)
  const paidCount = totals.priced_count

  // Best effort, after the response: a mail or push failure never undoes an acceptance.
  after(async () => {
    await Promise.allSettled([
      notifyRob({
        subject: `${company} accepted ${quote.quote_number}: ${paidCount} ${paidCount === 1 ? 'feature' : 'features'}, ${gbp(acceptance.total)}`,
        lines: [
          `${acceptance.signer_name}${body.data.signer_role ? ` (${body.data.signer_role})` : ''} accepted ${quote.quote_number}, ${quote.title}.`,
          `Email: ${body.data.signer_email}`,
          `Selected:\n${titles.map((title) => `- ${title}`).join('\n')}`,
          `Total: ${gbp(acceptance.total)}`,
        ],
        osPath: osQuotePath(ctx.quoteId),
        replyTo: body.data.signer_email,
        pushTitle: `${company} accepted ${quote.quote_number}`,
        pushBody: `${paidCount} features, ${gbp(acceptance.total)}`,
        tag: `quote:${ctx.quoteId}:accepted`,
      }),
      sendSignerConfirmation({
        to: body.data.signer_email,
        signerName: acceptance.signer_name,
        quote,
        acceptance,
        proposalUrl: `${appOrigin()}/proposal/${token}`,
      }),
    ]).then((results) => {
      for (const r of results) if (r.status === 'rejected') console.error('[proposal] post-accept task failed', r.reason)
    })
  })

  return NextResponse.json({ ok: true, acceptance })
}
