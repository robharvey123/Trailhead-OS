import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import IntegrationsClient from './IntegrationsClient'

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<WorkspaceRouteParams>
}) {
  const resolvedParams = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return <div className="p-8">You must be logged in.</div>
  }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', resolvedParams.workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  const isAdmin = member && ['owner', 'admin'].includes(member.role)

  const { data: integrations } = await supabase
    .from('workspace_integrations')
    .select('id, provider, status, config, connected_at, connected_by, created_at, updated_at')
    .eq('workspace_id', resolvedParams.workspaceId)
    .order('provider')

  return (
    <IntegrationsClient
      workspaceId={resolvedParams.workspaceId}
      initialIntegrations={integrations ?? []}
      isAdmin={!!isAdmin}
    />
  )
}
