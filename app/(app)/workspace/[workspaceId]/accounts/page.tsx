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

  const { data: accounts } = await supabase
    .from('crm_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name')

  return <AccountsClient workspaceId={workspaceId} initialAccounts={accounts || []} />
}
