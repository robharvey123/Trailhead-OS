import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import type { FinanceCreditNote } from '@/lib/finance/types'
import CreditNotesClient from './CreditNotesClient'

export default async function CreditNotesPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [creditNotesRes, accountsRes, invoicesRes, settingsRes] = await Promise.all([
    supabase.from('finance_credit_notes').select('*, crm_accounts(name)').eq('workspace_id', workspaceId).order('issue_date', { ascending: false }),
    supabase.from('crm_accounts').select('id, name').eq('workspace_id', workspaceId).order('name'),
    supabase.from('finance_invoices').select('id, invoice_number').eq('workspace_id', workspaceId).order('invoice_number'),
    supabase.from('workspace_settings').select('base_currency, supported_currencies').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  const creditNotes = (creditNotesRes.data || []).map((cn: Record<string, unknown>) => {
    const { crm_accounts, ...rest } = cn
    return {
      ...rest,
      account_name: (crm_accounts as Record<string, unknown> | null)?.name || null,
    } as FinanceCreditNote
  })

  return (
    <CreditNotesClient
      workspaceId={workspaceId}
      initialCreditNotes={creditNotes}
      accounts={accountsRes.data || []}
      invoices={invoicesRes.data || []}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
      supportedCurrencies={settingsRes.data?.supported_currencies || ['GBP', 'EUR', 'USD']}
    />
  )
}
