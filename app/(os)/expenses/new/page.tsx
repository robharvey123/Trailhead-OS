import ExpenseForm from '@/components/os/ExpenseForm'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { listEngagements } from '@/lib/db/engagements'
import { createClient } from '@/lib/supabase/server'

export default async function NewExpensePage() {
  const supabase = await createClient()
  const [accounts, workstreams, engagements] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
    listEngagements({ status: 'Active' }, supabase).catch(() => []),
  ])

  return (
    <ExpenseForm
      accounts={accounts}
      workstreams={workstreams}
      engagements={engagements.map((e) => ({ id: e.id, code: e.code ?? null, name: e.name, end_client_account_id: e.end_client_account_id }))}
    />
  )
}
