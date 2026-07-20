import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { calculateTotals, type Invoice } from '@/lib/types'

export const maxDuration = 60

/**
 * Daily cron: flip sent invoices whose due date has passed to 'overdue', and
 * email Rob a one-line chase for each newly-overdue invoice. Only 'sent'
 * invoices transition, so already-overdue ones are never re-emailed. Draft and
 * paid invoices are untouched. Client-facing dunning stays manual.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Only sent invoices past their due date make the transition — this excludes
  // already-overdue ones, so each invoice is emailed exactly once.
  const { data: due, error: fetchError } = await supabaseService
    .from('invoices')
    .select('*')
    .eq('status', 'sent')
    .lt('due_date', today)
    .not('due_date', 'is', null)
    .is('deleted_at', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, flagged: 0 })
  }

  const ids = (due as Invoice[]).map((inv) => inv.id)
  const { error: updateError } = await supabaseService
    .from('invoices')
    .update({ status: 'overdue' })
    .in('id', ids)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const notificationEmail = process.env.NOTIFICATION_EMAIL
  const errors: string[] = []

  if (resend && notificationEmail) {
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM

    for (const invoice of due as Invoice[]) {
      const total = calculateTotals(invoice.line_items, invoice.vat_rate).total
      const daysOverdue = invoice.due_date
        ? Math.floor((new Date(today).getTime() - new Date(invoice.due_date).getTime()) / 86400000)
        : 0
      const client = invoice.bill_to_name ?? 'Unknown client'

      try {
        await resend.emails.send({
          from: fromAddress,
          to: notificationEmail,
          subject: `Invoice overdue: ${invoice.invoice_number} (${client})`,
          html: `
            <p>Invoice <strong>${invoice.invoice_number}</strong> is now overdue.</p>
            <ul>
              <li>Client: ${client}</li>
              <li>Amount: £${total.toFixed(2)}</li>
              <li>Days overdue: ${daysOverdue}</li>
              <li>Due date: ${invoice.due_date}</li>
            </ul>
            <p><a href="${(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')}/invoicing/${invoice.id}">Open invoice</a></p>
          `,
        })
      } catch (err) {
        errors.push(`Invoice ${invoice.invoice_number}: ${err instanceof Error ? err.message : 'email failed'}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    flagged: ids.length,
    emailed: Boolean(resend && notificationEmail),
    errors: errors.length ? errors : undefined,
  })
}
