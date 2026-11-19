import { NextResponse, after } from 'next/server'
import { z } from 'zod'
import { logQuoteEvent } from '@/lib/quotes/events'
import { notifyRob, osQuotePath } from '@/lib/quotes/notify'
import { limitOrNull, proposalNotFound, readJson } from '@/lib/quotes/proposal-api'
import { getProposalContextByToken } from '@/lib/quotes/public'

export const runtime = 'nodejs'

const QuestionBody = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  message: z.string().trim().min(1, 'Enter a message').max(2000),
  /** Honeypot. People never see it; anything in it means a bot. */
  website: z.string().max(500).optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limited = limitOrNull(request, 'question', token, 5, 60 * 60 * 1000)
  if (limited) return limited

  const ctx = await getProposalContextByToken(token)
  if (!ctx) return proposalNotFound()

  const body = await readJson(request, QuestionBody)
  if (!body.ok) return body.response

  // Honeypot filled: answer exactly like a success, do nothing.
  if (body.data.website && body.data.website.trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const { name, email, message } = body.data
  const quote = ctx.publicQuote
  await logQuoteEvent(ctx.quoteId, 'question', { name, email, message })

  const company = quote.prepared_for.company ?? name
  // notifyRob escapes every line with escapeHtml before it reaches the HTML.
  after(() =>
    notifyRob({
      subject: `Question on ${quote.quote_number} from ${name}`,
      lines: [
        `${name} (${email})${quote.prepared_for.company ? ` at ${quote.prepared_for.company}` : ''} asked about ${quote.quote_number}, ${quote.title}:`,
        message,
        'Reply to this email to answer them directly.',
      ],
      osPath: osQuotePath(ctx.quoteId),
      replyTo: email,
      pushTitle: `Question on ${quote.quote_number}`,
      pushBody: `${company}: ${message.slice(0, 120)}`,
      tag: `quote:${ctx.quoteId}:question`,
    })
  )

  return NextResponse.json({ ok: true })
}
