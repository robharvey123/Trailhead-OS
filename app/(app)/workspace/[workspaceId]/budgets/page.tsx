import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceParams, type WorkspaceRouteParams } from '@/lib/route-params'
import BudgetsClient from './BudgetsClient'

export default async function BudgetsPage({ params }: { params: WorkspaceRouteParams | Promise<WorkspaceRouteParams> }) {
  const { workspaceId } = await resolveWorkspaceParams(params)
  const supabase = await createClient()

  const { data } = await supabase.from('finance_budgets').select('*').eq('workspace_id', workspaceId).order('period_start', { ascending: false })

  return <BudgetsClient workspaceId={workspaceId} initialBudgets={data || []} />
}
