import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ContentClient from './ContentClient'

export default async function ContentPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [contentRes, campaignsRes] = await Promise.all([
    supabase.from('marketing_content').select('*').eq('workspace_id', workspaceId).order('scheduled_date', { ascending: true }),
    supabase.from('marketing_campaigns').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  return <ContentClient workspaceId={workspaceId} initialContent={contentRes.data || []} campaigns={campaignsRes.data || []} />
}
