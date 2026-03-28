import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import CampaignsClient from './CampaignsClient'

export default async function CampaignsPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('marketing_campaigns').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return <CampaignsClient workspaceId={workspaceId} initialCampaigns={data || []} baseCurrency={ws?.base_currency || 'GBP'} />
}
