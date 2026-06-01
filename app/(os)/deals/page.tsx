import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listDeals } from '@/lib/db/deals'
import { getAccounts } from '@/lib/db/accounts'
import DealsClient from '@/components/os/DealsClient'

export const metadata = {
  title: 'Deals | Trailhead OS',
}

export default async function DealsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [deals, accounts] = await Promise.all([
    listDeals({}, supabase),
    getAccounts({}, supabase),
  ])

  return (
    <DealsClient
      initialDeals={deals}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
    />
  )
}
