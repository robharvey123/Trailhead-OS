import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ShipmentsClient from './ShipmentsClient'

export default async function ShipmentsPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('shipments').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })

  return <ShipmentsClient workspaceId={workspaceId} initialShipments={data || []} />
}
