import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [paymentsRes, invoicesRes, settingsRes] = await Promise.all([
    supabase.from('finance_payments').select('*').eq('workspace_id', workspaceId).order('payment_date', { ascending: false }),
    supabase.from('finance_invoices').select('id, invoice_number, account_id, direction, total, currency').eq('workspace_id', workspaceId).order('invoice_number'),
    supabase.from('workspace_settings').select('base_currency, supported_currencies').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  // Build invoice lookup
  const invoiceMap: Record<string, string> = {}
  for (const inv of invoicesRes.data || []) {
    invoiceMap[inv.id] = inv.invoice_number
  }

  return (
    <PaymentsClient
      workspaceId={workspaceId}
      initialPayments={paymentsRes.data || []}
      invoiceMap={invoiceMap}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
    />
  )
}
