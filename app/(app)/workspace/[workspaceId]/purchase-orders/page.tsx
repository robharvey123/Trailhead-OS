import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import PurchaseOrdersClient from './PurchaseOrdersClient'

export default async function PurchaseOrdersPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [posRes, accountsRes] = await Promise.all([
    supabase.from('finance_purchase_orders').select('*').eq('workspace_id', workspaceId).order('order_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])
  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return <PurchaseOrdersClient workspaceId={workspaceId} initialPOs={posRes.data || []} accounts={accountsRes.data || []} baseCurrency={ws?.base_currency || 'GBP'} />
}
