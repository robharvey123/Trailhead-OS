import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <p className="p-8 text-slate-500">Not authenticated</p>

  const { data } = await supabase.from('notifications').select('*').eq('workspace_id', workspaceId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)

  return <NotificationsClient workspaceId={workspaceId} initialNotifications={data || []} />
}
