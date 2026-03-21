import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import InvoicesClient from './InvoicesClient'

export default async function InvoicesPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [invoicesRes, accountsRes, settingsRes] = await Promise.all([
    supabase.from('finance_invoices').select('*').eq('workspace_id', workspaceId).order('issue_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name, address_line1, address_line2, city, state, postal_code, country, email, phone').eq('workspace_id', workspaceId).order('name'),
    supabase.from('workspace_settings').select('base_currency, supported_currencies').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  return (
    <InvoicesClient
      workspaceId={workspaceId}
      initialInvoices={invoicesRes.data || []}
      accounts={accountsRes.data || []}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
      supportedCurrencies={settingsRes.data?.supported_currencies || ['GBP', 'EUR', 'USD']}
    />
  )
}
