import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import DealsClient from './DealsClient'

export default async function DealsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [dealsRes, accountsRes, contactsRes, settingsRes] = await Promise.all([
    supabase.from('crm_deals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
    supabase.from('crm_contacts').select('id, first_name, last_name, account_id').eq('workspace_id', workspaceId).order('last_name'),
    supabase.from('workspace_settings').select('base_currency, supported_currencies').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  return (
    <DealsClient
      workspaceId={workspaceId}
      initialDeals={dealsRes.data || []}
      accounts={accountsRes.data || []}
      contacts={contactsRes.data || []}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
      supportedCurrencies={settingsRes.data?.supported_currencies || ['GBP', 'EUR', 'USD']}
    />
  )
}
