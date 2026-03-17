import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import TimeTrackingClient from './TimeTrackingClient'

export default async function TimeTrackingPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [entriesRes, staffRes] = await Promise.all([
    supabase.from('staff_time_entries').select('*, staff_profiles(display_name), workspace_tasks(title)').eq('workspace_id', workspaceId).order('date', { ascending: false }).limit(200),
    supabase.from('staff_profiles').select('id, display_name').eq('workspace_id', workspaceId).order('display_name'),
  ])

  const entries = (entriesRes.data || []).map((d: Record<string, unknown>) => ({
    ...d,
    staff_name: (d.staff_profiles as { display_name: string } | null)?.display_name || null,
    task_title: (d.workspace_tasks as { title: string } | null)?.title || null,
  }))

  return <TimeTrackingClient workspaceId={workspaceId} initialEntries={entries} staffList={staffRes.data || []} />
}
