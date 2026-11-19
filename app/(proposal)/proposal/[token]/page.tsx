import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { cache } from 'react'
import ProposalView from '@/components/proposal/ProposalView'
import { recordProposalView } from '@/lib/quotes/events'
import { getProposalContextByToken } from '@/lib/quotes/public'
import { initialSelection } from '@/lib/quotes/selection'
import { WHATSAPP_HREF, WHATSAPP_NUMBER } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

/**
 * Public client proposal, reached by an unguessable 256-bit token. Lives in its
 * own route group rather than (public) because that layout pins the Trailhead
 * logo over the page, and this page has its own dark hero lockup.
 *
 * Every failure (malformed, unknown, revoked, deleted, draft) is the same
 * notFound(), so the response never says why.
 */
export const dynamic = 'force-dynamic'

type Params = { token: string }

// One lookup per request, shared by generateMetadata and the page.
const loadContext = cache((token: string) => getProposalContextByToken(token))

const NOINDEX: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false, noimageindex: true },
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { token } = await params
  const ctx = await loadContext(token)
  const company = ctx?.publicQuote.prepared_for.company
  return {
    title: { absolute: ctx ? `Proposal for ${company ?? 'you'} | Trailhead` : 'Link no longer active | Trailhead' },
    description: null,
    robots: NOINDEX,
    referrer: 'no-referrer',
    // No quote content in link previews.
    openGraph: null,
    twitter: null,
  }
}

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ token }, query] = await Promise.all([params, searchParams])
  const ctx = await loadContext(token)
  if (!ctx) notFound()

  const quote = ctx.publicQuote
  const rawSel = typeof query.sel === 'string' ? query.sel : null
  const selected =
    quote.state === 'accepted' && quote.acceptance
      ? quote.acceptance.selected_line_item_ids
      : initialSelection(rawSel, quote.items)

  // Count the view after the response is sent, and only for visitors without
  // an OS session, so Rob opening his own link never counts.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const h = await headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown'
    after(() =>
      recordProposalView({
        quoteId: ctx.quoteId,
        token,
        ip,
        quoteNumber: quote.quote_number,
        company: quote.prepared_for.company,
      })
    )
  }

  return (
    <ProposalView
      quote={quote}
      token={token}
      initialSelected={selected}
      mode="live"
      contact={{ phoneLabel: WHATSAPP_NUMBER, phoneHref: `tel:${WHATSAPP_NUMBER.replace(/\s+/g, '')}`, whatsappHref: WHATSAPP_HREF }}
    />
  )
}
