import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { proposalPdfFilename, renderQuotePdf } from '@/lib/pdf/QuotePDF'
import { getPublicQuoteById } from '@/lib/quotes/public'
import { defaultSelection } from '@/lib/quotes/selection'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * OS download: the same PublicQuote projection and renderer a client gets, so
 * this file is what a client would download with the default selection (or
 * the accepted selection once accepted). Works for drafts too: the auth check
 * here replaces the public status gate.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    // RLS check first: the service-role projection below must not serve a quote
    // this session could not read itself.
    const { data: visible } = await auth.supabase.from('quotes').select('id').eq('id', id).is('deleted_at', null).maybeSingle()
    if (!visible) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const ctx = await getPublicQuoteById(id)
    if (!ctx) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = ctx.publicQuote
    const acceptance = quote.state === 'accepted' ? quote.acceptance : null
    const buffer = await renderQuotePdf({
      quote,
      selectedIds: acceptance ? acceptance.selected_line_item_ids : defaultSelection(quote.items),
      acceptance,
    })

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${proposalPdfFilename(quote)}"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate quote PDF' },
      { status: 500 }
    )
  }
}
