import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import StaffClient from './StaffClient'

export default async function StaffPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('staff_profiles').select('*').eq('workspace_id', workspaceId).order('display_name')

  return <StaffClient workspaceId={workspaceId} initialStaff={data || []} />
}
