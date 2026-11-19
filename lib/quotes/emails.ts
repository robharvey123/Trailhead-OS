import { BRAND, COMPANY, EMAIL_FONT } from '@/lib/brand'
import { DEFAULT_RESEND_FROM, resend } from '@/lib/email/resend'
import { escapeHtml } from '@/lib/escape-html'
import { gbp, longDate } from '@/lib/quotes/format'
import type { PublicQuote, PublicQuoteAcceptance } from '@/lib/types'

/**
 * Customer-facing proposal emails. Same sender as app/api/email/records
 * (RESEND_FROM_EMAIL or the default notifications address); replies go to Rob.
 * No em dashes in any of this copy.
 */

export function chosenTitles(quote: PublicQuote, ids: readonly string[]): string[] {
  const set = new Set(ids)
  return quote.items.filter((item) => set.has(item.id)).map((item) => item.title)
}

export async function sendSignerConfirmation(input: {
  to: string
  signerName: string
  quote: PublicQuote
  acceptance: PublicQuoteAcceptance
  proposalUrl: string
  pdf?: { filename: string; content: Buffer }
}): Promise<void> {
  if (!resend) {
    console.warn('[proposal] RESEND_API_KEY missing, signer confirmation not sent')
    return
  }
  const first = input.signerName.trim().split(/\s+/)[0] || input.signerName
  const titles = chosenTitles(input.quote, input.acceptance.selected_line_item_ids)
  const company = input.quote.prepared_for.company
  const lines = [
    `Hi ${first},`,
    `Thanks for accepting proposal ${input.quote.quote_number}${company ? ` for ${company}` : ''} on ${longDate(input.acceptance.accepted_at)}.`,
    `You chose: ${titles.join(', ')}.`,
    `Total: ${gbp(input.acceptance.total)}${input.quote.vat_rate > 0 ? ' including VAT' : ''}.`,
    'Rob will be in touch within one working day to agree a start date.',
  ]
  const html = `<div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.55;color:${BRAND.body};max-width:560px">
${lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join('\n')}
<p style="margin:20px 0"><a href="${escapeHtml(input.proposalUrl)}" style="display:inline-block;background:${BRAND.navy};color:${BRAND.paper};text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">View your proposal</a></p>
<p style="margin:0 0 4px;font-size:13px;color:${BRAND.slate}">Or copy this link: ${escapeHtml(input.proposalUrl)}</p>
<p style="margin:24px 0 0;font-size:13px;color:${BRAND.slate}">${escapeHtml(COMPANY.name)}. ${escapeHtml(COMPANY.registered)}, company number ${escapeHtml(COMPANY.number)}.</p>
</div>`

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM,
    to: [input.to],
    replyTo: COMPANY.email,
    subject: `Accepted: ${input.quote.title} (${input.quote.quote_number})`,
    html,
    text: [...lines, '', `View your proposal: ${input.proposalUrl}`].join('\n\n'),
    ...(input.pdf ? { attachments: [{ filename: input.pdf.filename, content: input.pdf.content.toString('base64') }] } : {}),
  })
  if (error) console.error('[proposal] signer confirmation failed', error)
}
