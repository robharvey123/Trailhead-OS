import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import DealDetailClient from './DealDetailClient'

export default async function DealDetailPage({ params }: { params: Promise<WorkspaceRouteParams & { id: string }> }) {
  const resolved = await Promise.resolve(params)
  const workspaceId = resolved.workspaceId
  const dealId = resolved.id
  const supabase = await createClient()

  const [dealRes, activitiesRes, invoicesRes, accountsRes] = await Promise.all([
    supabase.from('crm_deals').select('*').eq('id', dealId).eq('workspace_id', workspaceId).single(),
    supabase.from('crm_activities').select('*').eq('workspace_id', workspaceId).eq('deal_id', dealId).order('activity_date', { ascending: false }).limit(50),
    supabase.from('finance_invoices').select('id, invoice_number, status, total, amount_paid, currency, issue_date, direction').eq('workspace_id', workspaceId).eq('deal_id', dealId).order('issue_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  if (!dealRes.data) return <div className="p-8 text-slate-400">Deal not found</div>

  // Get account name
  let accountName: string | null = null
  if (dealRes.data.account_id) {
    const acc = accountsRes.data?.find((a: { id: string }) => a.id === dealRes.data!.account_id)
    accountName = acc?.name || null
  }

  // Get contact name
  let contactName: string | null = null
  if (dealRes.data.contact_id) {
    const { data: contact } = await supabase.from('crm_contacts').select('first_name, last_name').eq('id', dealRes.data.contact_id).maybeSingle()
    contactName = contact ? `${contact.first_name} ${contact.last_name}` : null
  }

  return (
    <DealDetailClient
      workspaceId={workspaceId}
      deal={dealRes.data}
      accountName={accountName}
      contactName={contactName}
      activities={activitiesRes.data || []}
      invoices={invoicesRes.data || []}
    />
  )
}
