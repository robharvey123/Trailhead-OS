import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hoursByEngagement } from '@/lib/db/reports'
import { mockupFontVars } from '@/lib/fonts'
import HoursByEngagementClient from '@/components/reports/HoursByEngagementClient'

export const dynamic = 'force-dynamic'

function monthRange() {
  const d = new Date()
  const iso = (x: Date) => x.toISOString().split('T')[0]
  return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

export default async function HoursByEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const def = monthRange()
  const from = sp.from || def.from
  const to = sp.to || def.to

  const rows = await hoursByEngagement(from, to, supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <span className="topbar-title">Hours by engagement</span>
          <form method="get" className="topbar-actions" style={{ gap: 6 }}>
            <input type="date" name="from" defaultValue={from} className="filter-select" />
            <input type="date" name="to" defaultValue={to} className="filter-select" />
            <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          </form>
        </div>

        <HoursByEngagementClient rows={rows} />
      </div>
    </div>
  )
}
