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
    .select('company_name, company_address, company_city, company_postcode, company_country, company_email, company_phone, company_vat_number, company_number, bank_name, bank_account_name, bank_sort_code, bank_account_number, bank_iban, bank_swift')
    .eq('workspace_id', invoice.workspace_id)
    .maybeSingle()

  const companyDetails = settings ? {
    company_name: settings.company_name,
    company_address: settings.company_address,
    company_city: settings.company_city,
    company_postcode: settings.company_postcode,
    company_country: settings.company_country,
    company_email: settings.company_email,
    company_phone: settings.company_phone,
    company_vat_number: settings.company_vat_number,
    company_number: settings.company_number,
    bank_name: settings.bank_name,
    bank_account_name: settings.bank_account_name,
    bank_sort_code: settings.bank_sort_code,
    bank_account_number: settings.bank_account_number,
    bank_iban: settings.bank_iban,
    bank_swift: settings.bank_swift,
  } : null

  const buffer = await renderInvoicePdf(invoice, accountName, companyDetails)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
