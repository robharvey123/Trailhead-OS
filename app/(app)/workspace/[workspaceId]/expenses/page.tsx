import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage({ params }: { params: Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const [expensesRes, settingsRes] = await Promise.all([
    supabase.from('finance_expense_claims').select('*').eq('workspace_id', workspaceId).order('expense_date', { ascending: false }),
    supabase.from('workspace_settings').select('base_currency, supported_currencies').eq('workspace_id', workspaceId).maybeSingle(),
  ])

  // Get current user role
  const { data: { user } } = await supabase.auth.getUser()
  const { data: member } = await supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user!.id).maybeSingle()

  return (
    <ExpensesClient
      workspaceId={workspaceId}
      initialExpenses={expensesRes.data || []}
      baseCurrency={settingsRes.data?.base_currency || 'GBP'}
      supportedCurrencies={settingsRes.data?.supported_currencies || ['GBP', 'EUR', 'USD']}
      currentUserId={user!.id}
      userRole={member?.role || 'viewer'}
    />
  )
}
