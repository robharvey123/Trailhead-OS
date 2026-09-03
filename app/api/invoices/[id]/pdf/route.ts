import { NextResponse } from 'next/server'
import { getAccountById } from '@/lib/db/accounts'
import { getContactById } from '@/lib/db/contacts'
import { listPayments } from '@/lib/db/invoice-payments'
import { getInvoiceById } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
import { getCompanySettings, getBankAccountForCurrency } from '@/lib/company-settings'
import { renderInvoicePdf } from '@/lib/pdf/InvoicePDF'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const invoice = await getInvoiceById(id, supabase).catch(() => null)

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const invoiceCurrency = invoice.currency ?? 'GBP'
  const [contact, account, workstreams, companySettings, bankAccount, payments] = await Promise.all([
    invoice.contact_id ? getContactById(invoice.contact_id, supabase).catch(() => null) : null,
    invoice.account_id ? getAccountById(invoice.account_id, supabase).catch(() => null) : null,
    getWorkstreams(supabase).catch(() => []),
    getCompanySettings(supabase).catch(() => null),
    invoiceCurrency !== 'GBP' ? getBankAccountForCurrency(invoiceCurrency, supabase).catch(() => null) : null,
    listPayments(id, supabase).catch(() => []),
  ])
  const workstream =
    workstreams.find((item) => item.id === invoice.workstream_id) ?? null
  const buffer = await renderInvoicePdf(invoice, contact, workstream, companySettings, bankAccount, account, payments)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
