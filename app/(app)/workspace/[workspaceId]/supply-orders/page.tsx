import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import SupplyOrdersClient from './SupplyOrdersClient'

export default async function SupplyOrdersPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [ordersRes, accountsRes] = await Promise.all([
    supabase.from('supply_orders').select('*').eq('workspace_id', workspaceId).order('order_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  return <SupplyOrdersClient workspaceId={workspaceId} initialOrders={ordersRes.data || []} accounts={accountsRes.data || []} />
}
