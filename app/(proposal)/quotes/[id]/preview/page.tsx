import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProposalView from '@/components/proposal/ProposalView'
import { canReadQuote } from '@/lib/quotes/os-access'
import { getPublicQuoteById } from '@/lib/quotes/public'
import { initialSelection } from '@/lib/quotes/selection'
import { WHATSAPP_HREF, WHATSAPP_NUMBER } from '@/lib/site'
import { createClient } from '@/lib/supabase/server'

/**
 * OS-only preview of the client page, before or after publishing. Outside the
 * (os) group so it renders full screen like the real page, and outside every
 * public allowlist, so middleware still requires a session. Accept, the PDF
 * and the question form are disabled by mode="preview". No view is counted.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Proposal preview | Trailhead OS' },
  robots: { index: false, follow: false },
}

export default async function ProposalPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  if (!(await canReadQuote(supabase, id))) notFound()

  const ctx = await getPublicQuoteById(id)
  if (!ctx) notFound()

  // Preview shows the page as a client would on an open proposal, whatever the
  // quote's status today, so drafts look exactly as they will once sent.
  const quote = { ...ctx.publicQuote, state: 'open' as const, acceptance: null }
  const rawSel = typeof query.sel === 'string' ? query.sel : null

  return (
    <ProposalView
      quote={quote}
      token={null}
      initialSelected={initialSelection(rawSel, quote.items)}
      mode="preview"
      contact={{ phoneLabel: WHATSAPP_NUMBER, phoneHref: `tel:${WHATSAPP_NUMBER.replace(/\s+/g, '')}`, whatsappHref: WHATSAPP_HREF }}
    />
  )
}
