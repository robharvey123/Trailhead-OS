import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { currentPeriodHoursByEngagement, listEngagements } from '@/lib/db/engagements'
import { mockupFontVars } from '@/lib/fonts'
import EngagementsClient from '@/components/os/engagements/EngagementsClient'

export const metadata = { title: 'Engagements | Trailhead OS' }

function monthStartISO() {
  // Direct YYYY-MM-01 string: new Date(y, m, 1).toISOString() shifts back a day in
  // timezones ahead of UTC (e.g. BST), reading the previous month's hours as zero.
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function EngagementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const monthStart = monthStartISO()
  const [engagements, milestonesThisMonth] = await Promise.all([
    listEngagements({}, supabase).catch(() => []),
    supabase.from('tier1_milestones').select('id', { count: 'exact', head: true }).gte('completed_at', `${monthStart}T00:00:00Z`),
  ])

  // Each engagement's CURRENT billing month (its own start day, e.g. 15th to 14th).
  const periodHours = await currentPeriodHoursByEngagement(engagements, supabase).catch(() => new Map())
  const hoursMap: Record<string, number> = {}
  for (const [id, h] of periodHours) hoursMap[id] = h.used

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <EngagementsClient
        engagements={engagements}
        hoursMap={hoursMap}
        milestonesCompletedThisMonth={milestonesThisMonth.count ?? 0}
      />
    </div>
  )
}
