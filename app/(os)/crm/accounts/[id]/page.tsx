import { notFound } from 'next/navigation'
import AccountDetailClient from '@/components/os/AccountDetailClient'
import { getAccountById } from '@/lib/db/accounts'
import { getActivities } from '@/lib/db/activities'
import { listProjectsByAccount } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { listDeals } from '@/lib/db/deals'
import { listTimeEntries } from '@/lib/db/timesheet'
import { tagsForAccount } from '@/lib/db/tags'
import { listThreads } from '@/lib/db/inbox'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const [account, workstreams, projects, activities, deals, timeEntries, tags, emailThreads] =
    await Promise.all([
      getAccountById(id, supabase).catch(() => null),
      getWorkstreams(supabase).catch(() => []),
      listProjectsByAccount(id, supabase).catch(() => []),
      getActivities({ account_id: id }, supabase).catch(() => []),
      listDeals({ account_id: id }, supabase).catch(() => []),
      listTimeEntries({ account_id: id, limit: 200 }, supabase).catch(() => []),
      tagsForAccount(id, supabase).catch(() => []),
      listThreads({ accountId: id }, supabase).catch(() => []),
    ])

  if (!account) {
    notFound()
  }

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <AccountDetailClient
        initialAccount={account}
        workstreams={workstreams}
        projects={projects}
        initialActivities={activities}
        deals={deals}
        timeEntries={timeEntries}
        tags={tags}
        emailThreads={emailThreads}
      />
    </div>
  )
}
