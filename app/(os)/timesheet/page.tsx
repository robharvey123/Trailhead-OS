import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
import { getProjects } from '@/lib/db/projects'
import { getRunningTimer } from '@/lib/db/timesheet'
import { listEngagements } from '@/lib/db/engagements'
import { listPeople, getPersonByAuthUser } from '@/lib/db/people'
import { mockupFontVars } from '@/lib/fonts'
import TimesheetClient, { type EngagementOption } from '@/components/os/TimesheetClient'

export const metadata = {
  title: 'Timesheet | Trailhead OS',
}

function monthStartISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

export default async function TimesheetPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const monthStart = monthStartISO()
  const [accounts, projects, runningTimer, engagements, hoursRows, people, ownPerson, taskRows] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    getRunningTimer(supabase).catch(() => null),
    listEngagements({ status: 'Active' }, supabase).catch(() => []),
    supabase.from('engagement_hours_by_month').select('engagement_id, hours_used').eq('period_month', monthStart),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
    getPersonByAuthUser(user.id, supabase).catch(() => null),
    // Open engagement tasks for the optional task picker (filtered client-side by engagement).
    supabase
      .from('engagement_tasks')
      .select('id, title, engagement_id')
      .not('engagement_id', 'is', null)
      .not('status', 'in', '(done,cancelled)')
      .order('updated_at', { ascending: false })
      .limit(500),
  ])

  const hoursMap: Record<string, number> = {}
  for (const r of (hoursRows.data ?? []) as Array<{ engagement_id: string; hours_used: number }>) {
    hoursMap[r.engagement_id] = Number(r.hours_used) || 0
  }

  const engagementOptions: EngagementOption[] = engagements.map((e) => ({
    id: e.id,
    name: e.name,
    included_hours_monthly: e.included_hours_monthly,
    account_id: e.end_client_account_id,
    hours_used_mtd: hoursMap[e.id] ?? 0,
    is_billable: e.is_billable,
  }))

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <TimesheetClient
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, account_id: p.account_id ?? null }))}
        initialTimer={runningTimer}
        engagements={engagementOptions}
        people={people.map((p) => ({ id: p.id, name: p.full_name }))}
        tasks={(taskRows.data ?? []) as Array<{ id: string; title: string; engagement_id: string | null }>}
        defaultPersonId={ownPerson?.id ?? null}
      />
    </div>
  )
}
