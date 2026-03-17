import { createClient } from '@/lib/supabase/server'
import {
  resolveWorkspaceParams,
  type WorkspaceRouteParams,
} from '@/lib/route-params'
import ContactsClient from './ContactsClient'

export default async function ContactsPage({
  params,
}: {
  params: WorkspaceRouteParams | Promise<WorkspaceRouteParams>
}) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [contactsRes, accountsRes] = await Promise.all([
    supabase.from('crm_contacts').select('*').eq('workspace_id', workspaceId).order('last_name'),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  return (
    <ContactsClient
      workspaceId={workspaceId}
      initialContacts={contactsRes.data || []}
      accounts={accountsRes.data || []}
    />
  )
}
