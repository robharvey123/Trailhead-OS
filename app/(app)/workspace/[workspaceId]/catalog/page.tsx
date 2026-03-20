import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import CatalogClient from './CatalogClient'

export default async function CatalogPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('products').select('*').eq('workspace_id', workspaceId).order('name')
  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return <CatalogClient workspaceId={workspaceId} initialProducts={data || []} baseCurrency={ws?.base_currency || 'GBP'} />
}
