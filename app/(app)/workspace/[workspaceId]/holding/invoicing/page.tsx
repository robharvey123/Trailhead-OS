import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import HoldingInvoicesClient from './HoldingInvoicesClient'

export default async function HoldingInvoicingPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()
  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return <HoldingInvoicesClient workspaceId={workspaceId} baseCurrency={ws?.base_currency || 'GBP'} />
}
