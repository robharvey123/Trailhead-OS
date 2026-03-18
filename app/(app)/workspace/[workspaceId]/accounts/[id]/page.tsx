import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AccountDetailClient from './AccountDetailClient'

type Params = { workspaceId: string; id: string }

export default async function AccountDetailPage({
  params,
}: {
  params: Params | Promise<Params>
}) {
  const { workspaceId, id } = await Promise.resolve(params)
  const supabase = await createClient()

  const [accountRes, contactsRes, dealsRes, activitiesRes] = await Promise.all([
    supabase.from('crm_accounts').select('*').eq('id', id).eq('workspace_id', workspaceId).single(),
    supabase.from('crm_contacts').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('last_name'),
    supabase.from('crm_deals').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('crm_activities').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('activity_date', { ascending: false }).limit(50),
  ])

  if (!accountRes.data) return notFound()

  return (
    <AccountDetailClient
      workspaceId={workspaceId}
      account={accountRes.data}
      contacts={contactsRes.data || []}
      deals={dealsRes.data || []}
      activities={activitiesRes.data || []}
    />
  )
}
