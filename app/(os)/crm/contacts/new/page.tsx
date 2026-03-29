import NewContactForm from '@/components/os/NewContactForm'
import { getAccounts } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function NewContactPage({
  searchParams,
}: {
  searchParams?: Promise<{ account_id?: string }>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const [workstreams, accounts] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getAccounts({}, supabase).catch(() => []),
  ])

  return (
    <NewContactForm
      workstreams={workstreams}
      accounts={accounts}
      initialAccountId={resolvedSearchParams?.account_id ?? ''}
    />
  )
}
