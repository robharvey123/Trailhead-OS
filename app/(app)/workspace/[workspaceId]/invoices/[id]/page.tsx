import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InvoiceDetailClient from './InvoiceDetailClient'

type Params = { workspaceId: string; id: string }

export default async function InvoiceDetailPage({ params }: { params: Params | Promise<Params> }) {
  const { workspaceId, id } = await Promise.resolve(params)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) redirect(`/workspace/${workspaceId}/invoices`)

  const [invoiceRes, paymentsRes, settingsRes, accountsRes] = await Promise.all([
    supabase.from('finance_invoices').select('*').eq('id', id).eq('workspace_id', workspaceId).single(),
    supabase.from('finance_payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false }),
    supabase
      .from('workspace_settings')
      .select('base_currency, supported_currencies, company_name, company_address, company_city, company_postcode, company_country, company_email, company_phone, company_vat_number')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  if (!invoiceRes.data) redirect(`/workspace/${workspaceId}/invoices`)

  // Resolve account name
  let accountName: string | null = null
  if (invoiceRes.data.account_id) {
    const match = (accountsRes.data || []).find((a: { id: string }) => a.id === invoiceRes.data.account_id)
    accountName = match?.name ?? null
  }

  const companyDetails = {
    company_name: settingsRes.data?.company_name ?? null,
    company_address: settingsRes.data?.company_address ?? null,
    company_city: settingsRes.data?.company_city ?? null,
    company_postcode: settingsRes.data?.company_postcode ?? null,
    company_country: settingsRes.data?.company_country ?? null,
    company_email: settingsRes.data?.company_email ?? null,
    company_phone: settingsRes.data?.company_phone ?? null,
    company_vat_number: settingsRes.data?.company_vat_number ?? null,
  }

  return (
    <InvoiceDetailClient
      workspaceId={workspaceId}
      invoice={invoiceRes.data}
      accountName={accountName}
      payments={paymentsRes.data || []}
      companyDetails={companyDetails}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
      supportedCurrencies={settingsRes.data?.supported_currencies || ['GBP', 'EUR', 'USD']}
    />
  )
}
