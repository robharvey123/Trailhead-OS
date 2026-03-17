import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import MessagesClient from './MessagesClient'

export default async function MessagesPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('comm_channels').select('*').eq('workspace_id', workspaceId).eq('is_archived', false).order('name')

  return <MessagesClient workspaceId={workspaceId} initialChannels={data || []} />
}
