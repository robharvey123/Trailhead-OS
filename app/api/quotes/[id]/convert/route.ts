import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createInvoice } from '@/lib/db/invoices'
import { getQuoteById, updateQuote } from '@/lib/db/quotes'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const { id } = await params

  try {
    const quote = await getQuoteById(id, auth.supabase)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.status === 'converted' && quote.converted_invoice_id) {
      return NextResponse.json({ invoice_id: quote.converted_invoice_id })
    }

    if (quote.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Only accepted quotes can be converted to invoices' },
        { status: 400 }
      )
    }

    const invoice = await createInvoice(
      {
        account_id: quote.account_id ?? null,
        contact_id: quote.contact_id ?? null,
        workstream_id: quote.workstream_id ?? null,
        pricing_tier_id: quote.pricing_tier_id ?? undefined,
        status: 'draft',
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: null,
        line_items: quote.line_items.map((item) => ({
          id: item.id,
          description: item.description,
          qty: item.qty,
          unit_price: item.unit_price,
        })),
        vat_rate: quote.vat_rate,
        notes: [quote.payment_terms, quote.notes].filter(Boolean).join('\n\n') || null,
      },
      auth.supabase
    )

    await updateQuote(
      quote.id,
      {
        status: 'converted',
        converted_invoice_id: invoice.id,
      },
      auth.supabase
    )

    return NextResponse.json({ invoice_id: invoice.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert quote' },
      { status: 500 }
    )
  }
}
