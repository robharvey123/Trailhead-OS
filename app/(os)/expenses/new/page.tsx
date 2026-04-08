import ExpenseForm from '@/components/os/ExpenseForm'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewExpensePage() {
  const supabase = await createClient()
  const [accounts, workstreams] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return <ExpenseForm accounts={accounts} workstreams={workstreams} />
}
