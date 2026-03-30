import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getContactById } from '@/lib/db/contacts'
import { getEnquiryById } from '@/lib/db/enquiries'
import { getInvoiceById } from '@/lib/db/invoices'
import { getQuoteById } from '@/lib/db/quotes'
import { getWorkstreams } from '@/lib/db/workstreams'
import { DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { renderInvoicePdf } from '@/lib/pdf/InvoicePDF'
import { renderQuotePdf } from '@/lib/pdf/QuotePDF'
import type { Enquiry, Invoice, QuoteListItem } from '@/lib/types'

const EmailRecordSchema = z.object({
  kind: z.enum(['enquiry', 'quote', 'invoice']),
  id: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().trim().min(1),
  message: z.string().optional().default(''),
})

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderMessageParagraphs(message: string) {
  if (!message.trim()) {
    return ''
  }

  return message
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br />')}</p>`)
    .join('')
}

function buildEnquirySummaryHtml(enquiry: Enquiry) {
  const entries: Array<[string, string]> = [
    ['Business', enquiry.biz_name],
    ['Contact', enquiry.contact_name],
    ['Email', enquiry.contact_email ?? '—'],
    ['Phone', enquiry.contact_phone ?? '—'],
    ['Business type', enquiry.biz_type ?? '—'],
    ['Project type', enquiry.project_type ?? '—'],
    ['Team size', enquiry.team_size ?? '—'],
    ['Team split', enquiry.team_split ?? '—'],
    ['Top features', enquiry.top_features.join(', ') || '—'],
    ['Calendar detail', enquiry.calendar_detail ?? '—'],
    ['Forms detail', enquiry.forms_detail ?? '—'],
    ['Devices', enquiry.devices.join(', ') || '—'],
    ['Offline capability', enquiry.offline_capability ?? '—'],
    ['Existing tools', enquiry.existing_tools ?? '—'],
    ['Pain points', enquiry.pain_points ?? '—'],
    ['Timeline', enquiry.timeline ?? '—'],
    ['Budget', enquiry.budget ?? '—'],
    ['Referral source', enquiry.referral_source ?? '—'],
    ['Extra context', enquiry.extra ?? '—'],
  ]

  return `
    <table style="width:100%;border-collapse:collapse">
      ${entries
        .map(
          ([label, value]) => `
            <tr>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;vertical-align:top">${escapeHtml(label)}</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;vertical-align:top;white-space:pre-wrap">${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join('')}
    </table>
  `
}

function buildQuoteEmailHtml(message: string, quote: QuoteListItem) {
  return `
    ${renderMessageParagraphs(message)}
    <p>Please find the attached quote${quote.quote_number ? ` (${escapeHtml(quote.quote_number)})` : ''}.</p>
    <p><strong>${escapeHtml(quote.title)}</strong></p>
  `
}

function buildInvoiceEmailHtml(message: string, invoice: Invoice) {
  return `
    ${renderMessageParagraphs(message)}
    <p>Please find the attached invoice <strong>${escapeHtml(invoice.invoice_number)}</strong>.</p>
  `
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => null)
  const parsed = EmailRecordSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 500 })
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM
  const resend = new Resend(resendKey)

  try {
    const { kind, id, recipients, subject, message } = parsed.data

    if (kind === 'enquiry') {
      const enquiry = await getEnquiryById(id, auth.supabase)

      if (!enquiry) {
        return NextResponse.json({ error: 'Enquiry not found.' }, { status: 404 })
      }

      await resend.emails.send({
        from: fromAddress,
        to: recipients,
        subject,
        html: `
          ${renderMessageParagraphs(message)}
          <p>Discovery summary for <strong>${escapeHtml(enquiry.biz_name)}</strong>.</p>
          ${buildEnquirySummaryHtml(enquiry)}
        `,
      })

      return NextResponse.json({ success: true })
    }

    if (kind === 'quote') {
      const quote = await getQuoteById(id, auth.supabase)

      if (!quote) {
        return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
      }

      const buffer = await renderQuotePdf(quote)

      await resend.emails.send({
        from: fromAddress,
        to: recipients,
        subject,
        html: buildQuoteEmailHtml(message, quote),
        attachments: [
          {
            filename: `${quote.quote_number}.pdf`,
            content: buffer.toString('base64'),
          },
        ],
      })

      return NextResponse.json({ success: true })
    }

    const invoice = await getInvoiceById(id, auth.supabase)

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }

    const [contact, workstreams] = await Promise.all([
      invoice.contact_id ? getContactById(invoice.contact_id, auth.supabase).catch(() => null) : null,
      getWorkstreams(auth.supabase).catch(() => []),
    ])
    const workstream =
      workstreams.find((item) => item.id === invoice.workstream_id) ?? null
    const buffer = await renderInvoicePdf(invoice, contact, workstream)

    await resend.emails.send({
      from: fromAddress,
      to: recipients,
      subject,
      html: buildInvoiceEmailHtml(message, invoice),
      attachments: [
        {
          filename: `${invoice.invoice_number}.pdf`,
          content: buffer.toString('base64'),
        },
      ],
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email.' },
      { status: 500 }
    )
  }
}
