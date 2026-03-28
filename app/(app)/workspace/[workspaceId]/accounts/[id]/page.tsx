import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import AccountDetailClient from './AccountDetailClient'

type Params = { workspaceId: string; id: string }

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { workspaceId, id } = await Promise.resolve(params)
  const supabase = await createClient()

  const [accountRes, contactsRes, dealsRes, activitiesRes, invoicesRes] = await Promise.all([
    supabase.from('crm_accounts').select('*').eq('id', id).eq('workspace_id', workspaceId).single(),
    supabase.from('crm_contacts').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('last_name'),
    supabase.from('crm_deals').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('crm_activities').select('*').eq('account_id', id).eq('workspace_id', workspaceId).order('activity_date', { ascending: false }).limit(50),
    supabase.from('finance_invoices').select('id, invoice_number, status, total, amount_paid, currency, issue_date, due_date, direction').eq('workspace_id', workspaceId).eq('account_id', id).order('issue_date', { ascending: false }),
  ])

  if (!accountRes.data) return notFound()

  const { data: ws } = await supabase.from('workspace_settings').select('base_currency').eq('workspace_id', workspaceId).maybeSingle()

  return (
    <AccountDetailClient
      workspaceId={workspaceId}
      account={accountRes.data}
      contacts={contactsRes.data || []}
      deals={dealsRes.data || []}
      activities={activitiesRes.data || []}
      invoices={invoicesRes.data || []}
      baseCurrency={ws?.base_currency || 'GBP'}
    />
  )
}
