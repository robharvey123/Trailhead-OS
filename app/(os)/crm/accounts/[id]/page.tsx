import { notFound } from 'next/navigation'
import AccountDetailClient from '@/components/os/AccountDetailClient'
import { getAccountById } from '@/lib/db/accounts'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [account, workstreams] = await Promise.all([
    getAccountById(id, supabase).catch(() => null),
    getWorkstreams(supabase).catch(() => []),
  ])

  if (!account) {
    notFound()
  }

  return <AccountDetailClient initialAccount={account} workstreams={workstreams} />
}
