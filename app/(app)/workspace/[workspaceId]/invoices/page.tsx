import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import InvoicesClient from './InvoicesClient'

export default async function InvoicesPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [invoicesRes, accountsRes] = await Promise.all([
    supabase.from('finance_invoices').select('*').eq('workspace_id', workspaceId).order('issue_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
  ])

  return <InvoicesClient workspaceId={workspaceId} initialInvoices={invoicesRes.data || []} accounts={accountsRes.data || []} />
}
