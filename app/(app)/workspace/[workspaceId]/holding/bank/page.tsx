import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import BankClient from './BankClient'

export default async function BankPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()
  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return <BankClient workspaceId={workspaceId} baseCurrency={ws?.base_currency || 'GBP'} />
}
