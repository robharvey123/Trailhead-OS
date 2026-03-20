import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderInvoicePdf } from '@/lib/finance/invoice-pdf'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: invoice, error } = await supabase
    .from('finance_invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  // Verify workspace membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', invoice.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Fetch account name if linked
  let accountName: string | null = null
  if (invoice.account_id) {
    const { data: account } = await supabase
      .from('crm_accounts')
      .select('name')
      .eq('id', invoice.account_id)
      .maybeSingle()
    accountName = account?.name ?? null
  }

  // Fetch company details
  const { data: settings } = await supabase
    .from('workspace_settings')
    .select('company_name, company_address, company_city, company_postcode, company_country, company_email, company_phone, company_vat_number')
    .eq('workspace_id', invoice.workspace_id)
    .maybeSingle()

  const buffer = await renderInvoicePdf(invoice, accountName, settings)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
