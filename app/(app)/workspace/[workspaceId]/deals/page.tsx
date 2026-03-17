import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import DealsClient from './DealsClient'

export default async function DealsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [dealsRes, accountsRes] = await Promise.all([
    supabase.from('crm_deals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  return (
    <DealsClient
      workspaceId={workspaceId}
      initialDeals={dealsRes.data || []}
      accounts={accountsRes.data || []}
    />
  )
}
