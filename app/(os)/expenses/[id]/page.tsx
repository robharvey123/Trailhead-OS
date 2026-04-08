import { notFound } from 'next/navigation'
import ExpenseForm from '@/components/os/ExpenseForm'
import { getExpenseById } from '@/lib/db/expenses'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
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

  const [accounts, workstreams] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getWorkstreams(supabase).catch(() => []),
  ])

  return (
    <ExpenseForm
      accounts={accounts}
      workstreams={workstreams}
      initialExpense={expense}
    />
  )
}
