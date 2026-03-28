import { NextResponse } from 'next/server'
import { getContactById } from '@/lib/db/contacts'
import { getInvoiceById } from '@/lib/db/invoices'
import { getWorkstreams } from '@/lib/db/workstreams'
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

  const [contact, workstreams] = await Promise.all([
    invoice.contact_id ? getContactById(invoice.contact_id, supabase).catch(() => null) : null,
    getWorkstreams(supabase).catch(() => []),
  ])
  const workstream =
    workstreams.find((item) => item.id === invoice.workstream_id) ?? null
  const buffer = await renderInvoicePdf(invoice, contact, workstream)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  })
}
