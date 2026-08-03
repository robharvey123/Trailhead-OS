import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import type { Invoice } from '@/lib/types'

export const maxDuration = 60

/**
 * Daily cron: generate new draft invoices for any recurring invoice
 * whose next_invoice_date is today or in the past.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Fetch all due recurring invoices
  const { data: due, error: fetchError } = await supabaseService
    .from('invoices')
    .select('*')
    .eq('is_recurring', true)
    .lte('next_invoice_date', today)
    .neq('status', 'cancelled')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, created: 0 })
  }

  let created = 0
  const errors: string[] = []

  for (const source of due as Invoice[]) {
    const nextDate = source.next_invoice_date
    if (!nextDate) continue

    // Compute the following next_invoice_date after this one
    const newBase = new Date(nextDate)
    if (source.recurring_interval === 'month') {
      newBase.setMonth(newBase.getMonth() + 1)
    } else {
      newBase.setFullYear(newBase.getFullYear() + 1)
    }
    const followingDate = newBase.toISOString().slice(0, 10)

    // Derive due_date offset from original invoice (default 30 days if not set)
    let newDueDate: string | null = null
    if (source.due_date && source.issue_date) {
      const originalIssue = new Date(source.issue_date)
      const originalDue = new Date(source.due_date)
      const offsetMs = originalDue.getTime() - originalIssue.getTime()
      const newDue = new Date(nextDate)
      newDue.setTime(newDue.getTime() + offsetMs)
      newDueDate = newDue.toISOString().slice(0, 10)
    }

    // Carry the currency, but do NOT copy the parent's FX rate — a September
    // retainer generated at July's rate is a silent mispricing. GBP is always
    // rate 1.0. A non-GBP recurring template has no live FX source in the OS, so
    // the generated draft is flagged for a fresh rate before it is sent (it stays
    // a draft, so it can't go out un-reviewed).
    const sourceCurrency = (source.currency as string | null) ?? 'GBP'
    const isGbp = sourceCurrency === 'GBP'
    const fxToGbp = isGbp ? 1.0 : Number(source.fx_rate_to_gbp ?? 1)
    const fxSource = isGbp ? null : 'NEEDS RE-SNAPSHOT (recurring) — verify rate before sending'
    if (!isGbp) {
      errors.push(`Invoice ${source.id}: generated a ${sourceCurrency} draft — set a fresh FX rate before sending.`)
    }

    // Create the new draft invoice
    const { error: insertError } = await supabaseService
      .from('invoices')
      .insert({
        account_id: source.account_id,
        contact_id: source.contact_id,
        workstream_id: source.workstream_id,
        pricing_tier_id: source.pricing_tier_id ?? null,
        status: 'draft',
        issue_date: nextDate,
        due_date: newDueDate,
        line_items: source.line_items,
        vat_rate: source.vat_rate,
        currency: sourceCurrency,
        fx_rate_to_gbp: fxToGbp,
        fx_rate_date: isGbp ? null : nextDate,
        fx_rate_source: fxSource,
        bill_to_name: source.bill_to_name,
        bill_to_address: source.bill_to_address,
        bill_to_city: source.bill_to_city,
        bill_to_postcode: source.bill_to_postcode,
        bill_to_country: source.bill_to_country,
        bill_to_email: source.bill_to_email,
        bill_to_phone: source.bill_to_phone,
        notes: source.notes,
        is_recurring: false,
        recurring_interval: source.recurring_interval,
        next_invoice_date: null,
      })

    if (insertError) {
      errors.push(`Invoice ${source.id}: ${insertError.message}`)
      continue
    }

    // Advance the source invoice's next_invoice_date. Only the source recurs.
    const { error: advanceError } = await supabaseService
      .from('invoices')
      .update({ next_invoice_date: followingDate })
      .eq('id', source.id)

    if (advanceError) {
      errors.push(`Invoice ${source.id} date advance: ${advanceError.message}`)
    }

    created++
  }

  return NextResponse.json({ ok: true, created, errors: errors.length ? errors : undefined })
}
