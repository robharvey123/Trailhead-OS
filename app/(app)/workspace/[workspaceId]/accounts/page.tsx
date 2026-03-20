import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import AccountsClient from './AccountsClient'

export default async function AccountsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [accountsRes, contactsRes, dealsRes] = await Promise.all([
    supabase.from('crm_accounts').select('*').eq('workspace_id', workspaceId).order('name'),
    supabase.from('crm_contacts').select('id, account_id').eq('workspace_id', workspaceId),
    supabase.from('crm_deals').select('id, account_id, value, stage').eq('workspace_id', workspaceId),
  ])

  // Build relationship counts per account
  const contactCounts = new Map<string, number>()
  for (const c of contactsRes.data || []) {
    if (c.account_id) contactCounts.set(c.account_id, (contactCounts.get(c.account_id) || 0) + 1)
  }

  const dealCounts = new Map<string, number>()
  const pipelineValues = new Map<string, number>()
  for (const d of dealsRes.data || []) {
    if (d.account_id) {
      dealCounts.set(d.account_id, (dealCounts.get(d.account_id) || 0) + 1)
      if (!d.stage.startsWith('closed_')) {
        pipelineValues.set(d.account_id, (pipelineValues.get(d.account_id) || 0) + (d.value || 0))
      }
    }
  }

  const accountStats = Object.fromEntries(
    (accountsRes.data || []).map((a) => [
      a.id,
      {
        contacts: contactCounts.get(a.id) || 0,
        deals: dealCounts.get(a.id) || 0,
        pipeline: pipelineValues.get(a.id) || 0,
      },
    ])
  )

  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return (
    <AccountsClient
      workspaceId={workspaceId}
      initialAccounts={accountsRes.data || []}
      stats={accountStats}
      baseCurrency={ws?.base_currency || 'GBP'}
    />
  )
}
