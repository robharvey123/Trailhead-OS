import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hoursByPerson } from '@/lib/db/reports'
import { formatCurrency } from '@/lib/format'
import { mockupFontVars } from '@/lib/fonts'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = { title: 'Hours by person' }

export const dynamic = 'force-dynamic'

function monthRange() {
  const d = new Date()
  const iso = (x: Date) => x.toISOString().split('T')[0]
  return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

export default async function HoursByPersonPage({
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

  const rows = await hoursByPerson(from, to, supabase).catch(() => [])

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <PageHeader
        title="Hours by person"
        actions={
          <form method="get" className="flex items-center gap-1.5">
            <input type="date" name="from" defaultValue={from} className="filter-select" />
            <input type="date" name="to" defaultValue={to} className="filter-select" />
            <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          </form>
        }
      />
      <div className="panel overflow-hidden">
        <div className="grid gap-4 p-6">
          {rows.length === 0 ? (
            <div className="empty">No time logged in this range.</div>
          ) : (
            rows.map((p) => (
              <details key={p.person_id ?? 'none'} className="card" open>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="td-name">{p.person_name}</span>
                  <span className="td-num text-[var(--text-2)]!">
                    {p.total_hours.toFixed(1)}h · {p.billable_hours.toFixed(1)}h billable · {formatCurrency(p.total_cost, 'GBP')}
                  </span>
                </summary>
                <div className="overflow-x-auto">
                <table className="data-table mt-2.5">
                  <thead>
                    <tr>
                      <th>Engagement</th>
                      <th className="text-right!">Hours</th>
                      <th className="text-right!">Billable</th>
                      <th className="text-right!">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.byEngagement.map((e) => (
                      <tr key={e.engagement_name}>
                        <td className="td-name">{e.engagement_name}</td>
                        <td className="td-num text-right">{e.hours.toFixed(1)}h</td>
                        <td className="td-num text-right">{e.billable_hours.toFixed(1)}h</td>
                        <td className="td-num text-right">{formatCurrency(e.cost, 'GBP')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
