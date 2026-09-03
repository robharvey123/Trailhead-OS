import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { resend, DEFAULT_RESEND_FROM } from '@/lib/email/resend'
import { calculateTotals, roundMoney, type Invoice } from '@/lib/types'

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

  // Sent and part-paid invoices past their due date are fetched for the chase
  // email; only 'sent' ones transition to 'overdue' (a part-paid invoice keeps
  // its status — the ledger owns paid/part_paid). Each invoice is emailed once.
  const { data: due, error: fetchError } = await supabaseService
    .from('invoices')
    .select('*')
    .in('status', ['sent', 'part_paid'])
    .lt('due_date', today)
    .not('due_date', 'is', null)
    .is('deleted_at', null)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, flagged: 0 })
  }

  const ids = (due as Invoice[]).filter((inv) => inv.status === 'sent').map((inv) => inv.id)
  const { error: updateError } = ids.length
    ? await supabaseService.from('invoices').update({ status: 'overdue' }).in('id', ids)
    : { error: null }

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const notificationEmail = process.env.NOTIFICATION_EMAIL
  const errors: string[] = []

  if (resend && notificationEmail) {
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM

    // Chase on the outstanding balance, not the full total — part payments count.
    const { data: paymentRows } = await supabaseService
      .from('invoice_payments')
      .select('invoice_id, amount')
      .in('invoice_id', (due as Invoice[]).map((inv) => inv.id))
    const paidByInvoice = new Map<string, number>()
    for (const p of (paymentRows ?? []) as Array<{ invoice_id: string; amount: number }>) {
      paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount))
    }

    for (const invoice of due as Invoice[]) {
      const total = roundMoney(
        calculateTotals(invoice.line_items, invoice.vat_rate).total - (paidByInvoice.get(invoice.id) ?? 0)
      )
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
              <li>Outstanding: £${total.toFixed(2)}</li>
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
