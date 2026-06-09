import { notFound } from 'next/navigation'
import AccountDetailClient from '@/components/os/AccountDetailClient'
import { getAccountById } from '@/lib/db/accounts'
import { getActivities } from '@/lib/db/activities'
import { listProjectsByAccount } from '@/lib/db/projects'
import { getWorkstreams } from '@/lib/db/workstreams'
import { listDeals } from '@/lib/db/deals'
import { listMeetingNotesForAccount } from '@/lib/db/meeting-notes'
import { listTimeEntries } from '@/lib/db/timesheet'
import { tagsForAccount } from '@/lib/db/tags'
import { listThreads } from '@/lib/db/inbox'
import { getCompanySettings } from '@/lib/company-settings'
import { mockupFontVars } from '@/lib/fonts'
import { createClient } from '@/lib/supabase/server'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [account, workstreams, projects, activities, deals, timeEntries, tags, emailThreads, meetingNotes] =
    await Promise.all([
      getAccountById(id, supabase).catch(() => null),
      getWorkstreams(supabase).catch(() => []),
      listProjectsByAccount(id, supabase).catch(() => []),
      getActivities({ account_id: id }, supabase).catch(() => []),
      listDeals({ account_id: id }, supabase).catch(() => []),
      listTimeEntries({ account_id: id, limit: 200 }, supabase).catch(() => []),
      tagsForAccount(id, supabase).catch(() => []),
      listThreads({ accountId: id }, supabase).catch(() => []),
      listMeetingNotesForAccount(id, supabase).catch(() => []),
    ])
  const settings = await getCompanySettings(supabase).catch(() => null)

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
        meetingNotes={meetingNotes}
        selfEmail={user?.email ?? ''}
        signature={settings?.email_signature ?? ''}
      />
    </div>
  )
}
