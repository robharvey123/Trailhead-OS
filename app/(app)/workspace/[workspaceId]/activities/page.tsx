import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ActivitiesClient from './ActivitiesClient'

export default async function ActivitiesPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [activitiesRes, accountsRes, contactsRes, dealsRes] = await Promise.all([
    supabase.from('crm_activities').select('*').eq('workspace_id', workspaceId).order('activity_date', { ascending: false }).limit(200),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
    supabase.from('crm_contacts').select('id, first_name, last_name, account_id').eq('workspace_id', workspaceId).order('first_name'),
    supabase.from('crm_deals').select('id, title, account_id').eq('workspace_id', workspaceId).order('title'),
  ])

  return (
    <ActivitiesClient
      workspaceId={workspaceId}
      initialActivities={activitiesRes.data || []}
      accounts={accountsRes.data || []}
      contacts={(contactsRes.data || []).map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, account_id: c.account_id }))}
      deals={(dealsRes.data || []).map((d) => ({ id: d.id, title: d.title, account_id: d.account_id }))}
    />
  )
}
