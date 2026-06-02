import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEngagement } from '@/lib/db/engagements'
import { listTimeEntries } from '@/lib/db/timesheet'
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

  const [timeEntries, projectsRes, accounts] = await Promise.all([
    listTimeEntries({ engagement_id: id, limit: 300 }, supabase).catch(() => []),
    supabase.from('projects').select('id, name, status').eq('engagement_id', id),
    getAccounts({}, supabase).catch(() => []),
  ])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <EngagementDetailClient
        detail={detail}
        timeEntries={timeEntries}
        projects={(projectsRes.data ?? []) as Array<{ id: string; name: string; status: string }>}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  )
}
