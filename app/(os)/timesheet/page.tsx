import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAccounts } from '@/lib/db/accounts'
import { getProjects } from '@/lib/db/projects'
import { getRunningTimer } from '@/lib/db/timesheet'
import { listEngagements } from '@/lib/db/engagements'
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
  const [accounts, projects, runningTimer, engagements, hoursRows] = await Promise.all([
    getAccounts({}, supabase).catch(() => []),
    getProjects({}, supabase).catch(() => []),
    getRunningTimer(supabase).catch(() => null),
    listEngagements({ status: 'Active' }, supabase).catch(() => []),
    supabase.from('engagement_hours_by_month').select('engagement_id, hours_used').eq('period_month', monthStart),
  ])

  const hoursMap: Record<string, number> = {}
  for (const r of (hoursRows.data ?? []) as Array<{ engagement_id: string; hours_used: number }>) {
    hoursMap[r.engagement_id] = Number(r.hours_used) || 0
  }

  const engagementOptions: EngagementOption[] = engagements.map((e) => ({
    id: e.id,
    name: e.name,
    workstreams: e.workstreams ?? [],
    included_hours_monthly: e.included_hours_monthly,
    account_id: e.end_client_account_id,
    hours_used_mtd: hoursMap[e.id] ?? 0,
  }))

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <TimesheetClient
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, account_id: p.account_id ?? null }))}
        initialTimer={runningTimer}
        engagements={engagementOptions}
      />
    </div>
  )
}
