import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContactDetailClient from './ContactDetailClient'

type Params = { workspaceId: string; id: string }

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { workspaceId, id } = await Promise.resolve(params)
  const supabase = await createClient()

  const [contactRes, dealsRes, activitiesRes] = await Promise.all([
    supabase.from('crm_contacts').select('*').eq('id', id).eq('workspace_id', workspaceId).single(),
    supabase.from('crm_deals').select('*').eq('contact_id', id).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('crm_activities').select('*').eq('contact_id', id).eq('workspace_id', workspaceId).order('activity_date', { ascending: false }).limit(50),
  ])

  if (!contactRes.data) return notFound()

  // Get account name
  let accountName: string | null = null
  if (contactRes.data.account_id) {
    const { data: acc } = await supabase.from('crm_accounts').select('name').eq('id', contactRes.data.account_id).maybeSingle()
    accountName = acc?.name || null
  }

  return (
    <ContactDetailClient
      workspaceId={workspaceId}
      contact={contactRes.data}
      accountName={accountName}
      deals={dealsRes.data || []}
      activities={activitiesRes.data || []}
    />
  )
}
