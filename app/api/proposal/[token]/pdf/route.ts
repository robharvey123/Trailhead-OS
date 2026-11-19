import { NextResponse } from 'next/server'
import { renderQuotePdf, proposalPdfFilename } from '@/lib/pdf/QuotePDF'
import { logQuoteEvent } from '@/lib/quotes/events'
import { limitOrNull, proposalNotFound } from '@/lib/quotes/proposal-api'
import { getProposalContextByToken } from '@/lib/quotes/public'
import { initialSelection } from '@/lib/quotes/selection'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Public proposal PDF: exactly what the client selected on the page (?sel=),
 * or, once accepted, exactly what was accepted, ignoring ?sel=.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limited = limitOrNull(request, 'pdf', token, 20, 10 * 60 * 1000)
  if (limited) return limited

  const ctx = await getProposalContextByToken(token)
  if (!ctx) return proposalNotFound()

  const quote = ctx.publicQuote
  const acceptance = quote.state === 'accepted' ? quote.acceptance : null
  const sel = new URL(request.url).searchParams.get('sel')
  const selectedIds = acceptance ? acceptance.selected_line_item_ids : initialSelection(sel, quote.items)

  try {
    const buffer = await renderQuotePdf({ quote, selectedIds, acceptance })
    await logQuoteEvent(ctx.quoteId, 'pdf_downloaded', { signed: Boolean(acceptance), items: selectedIds.length })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${proposalPdfFilename(quote)}"`,
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    console.error('[proposal] pdf render failed', error)
    return NextResponse.json({ error: 'Could not create the PDF. Please try again.' }, { status: 500 })
  }
}
