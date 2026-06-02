import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listEngagements } from '@/lib/db/engagements'
import { mockupFontVars } from '@/lib/fonts'
import EngagementsClient from '@/components/os/engagements/EngagementsClient'

export const metadata = { title: 'Engagements | Trailhead OS' }

function monthStartISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

export default async function EngagementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const monthStart = monthStartISO()
  const [engagements, hoursRows, milestonesThisMonth] = await Promise.all([
    listEngagements({}, supabase).catch(() => []),
    supabase.from('engagement_hours_by_month').select('engagement_id, hours_used').eq('period_month', monthStart),
    supabase.from('tier1_milestones').select('id', { count: 'exact', head: true }).gte('completed_at', `${monthStart}T00:00:00Z`),
  ])

  const hoursMap: Record<string, number> = {}
  for (const r of (hoursRows.data ?? []) as Array<{ engagement_id: string; hours_used: number }>) {
    hoursMap[r.engagement_id] = Number(r.hours_used) || 0
  }

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
