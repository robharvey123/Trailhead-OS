import { notFound } from 'next/navigation'
import ExpenseForm from '@/components/os/ExpenseForm'
import { getExpenseById } from '@/lib/db/expenses'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { listEngagements } from '@/lib/db/engagements'
import { createClient } from '@/lib/supabase/server'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const expense = await getExpenseById(id, supabase).catch(() => null)

  if (!expense) {
    notFound()
  }

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
      initialExpense={expense}
    />
  )
}
