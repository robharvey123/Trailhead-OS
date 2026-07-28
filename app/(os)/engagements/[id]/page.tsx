import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEngagement, engagementLinkCounts, engagementAccountIds } from '@/lib/db/engagements'
import { getEngagementTouchpoints } from '@/lib/db/touchpoints'
import { listTimeEntries } from '@/lib/db/timesheet'
import { listApprovals } from '@/lib/db/approvals'
import { listContributors } from '@/lib/db/contributors'
import { listPeople } from '@/lib/db/people'
import { getAccounts } from '@/lib/db/accounts'
import { mockupFontVars } from '@/lib/fonts'
import EngagementDetailClient from '@/components/os/engagements/EngagementDetailClient'

export default async function EngagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const detail = await getEngagement(id, supabase).catch(() => null)
  if (!detail) notFound()

  const [timeEntries, projectsRes, accounts, docsRes, linkCounts, contributors, people, touchpoints] = await Promise.all([
    listTimeEntries({ engagement_id: id, limit: 300 }, supabase).catch(() => []),
    supabase.from('projects').select('id, name, status').eq('engagement_id', id),
    getAccounts({}, supabase).catch(() => []),
    supabase.from('engagement_documents').select('id, type, title, week_start, created_at, file_path, file_name, mime_type, size_bytes').eq('engagement_id', id).order('created_at', { ascending: false }),
    engagementLinkCounts(id, supabase).catch(() => ({ projects: 0, timeEntries: 0, milestones: 0, approvals: 0, documents: 0, touchpoints: 0 })),
    listContributors(id, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
    getEngagementTouchpoints(id, engagementAccountIds(detail), supabase).catch(() => []),
  ])
  const approvals = await listApprovals(id, supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <EngagementDetailClient
        detail={detail}
        timeEntries={timeEntries}
        projects={(projectsRes.data ?? []) as Array<{ id: string; name: string; status: string }>}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        documents={(docsRes.data ?? []) as Array<{ id: string; type: string; title: string | null; week_start: string | null; created_at: string; file_path: string | null; file_name: string | null; mime_type: string | null; size_bytes: number | null }>}
        approvals={approvals}
        linkCounts={linkCounts}
        contributors={contributors}
        people={people}
        touchpoints={touchpoints}
      />
    </div>
  )
}
