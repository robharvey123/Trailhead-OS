import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createPaymentLink, getOrCreateStripeCustomer } from '@/lib/stripe/helpers'
import { calculateTotals } from '@/lib/types'

type InvoiceWithRelations = {
  id: string
  invoice_number: string
  account_id: string | null
  line_items: Array<{ id: string; description: string; qty: number; unit_price: number }>
  vat_rate: number
  accounts: { id: string; name: string } | null
  contacts: { id: string; email: string | null } | null
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : ''

  if (!invoiceId) {
    return NextResponse.json({ error: 'invoice_id is required' }, { status: 400 })
  }

  try {
    const { data: invoice, error } = await auth.supabase
      .from('invoices')
      .select('id, invoice_number, account_id, line_items, vat_rate, accounts(id, name), contacts(id, email)')
      .eq('id', invoiceId)
      .maybeSingle<InvoiceWithRelations>()

    if (error) {
      throw new Error(error.message)
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
    const amountPence = Math.round(totals.total * 100)

    let stripeCustomerId: string | undefined
    if (invoice.account_id && invoice.accounts?.name) {
      stripeCustomerId = await getOrCreateStripeCustomer(
        invoice.account_id,
        invoice.accounts.name,
        invoice.contacts?.email ?? undefined
      )
    }

    const paymentLink = await createPaymentLink(
      invoice.id,
      invoice.invoice_number,
      amountPence,
      invoice.contacts?.email ?? undefined,
      stripeCustomerId
    )

    return NextResponse.json({ payment_link: paymentLink })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Stripe payment link' },
      { status: 500 }
    )
  }
}
