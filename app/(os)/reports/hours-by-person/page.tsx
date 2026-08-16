import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hoursByPerson } from '@/lib/db/reports'
import { formatCurrency } from '@/lib/format'
import { mockupFontVars } from '@/lib/fonts'

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
      <div className="panel overflow-hidden">
        <div className="topbar">
          <span className="topbar-title">Hours by person</span>
          <form method="get" className="topbar-actions" style={{ gap: 6 }}>
            <input type="date" name="from" defaultValue={from} className="filter-select" />
            <input type="date" name="to" defaultValue={to} className="filter-select" />
            <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          </form>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 16 }}>
          {rows.length === 0 ? (
            <div className="empty">No time logged in this range.</div>
          ) : (
            rows.map((p) => (
              <details key={p.person_id ?? 'none'} className="card" open>
                <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', listStyle: 'none' }}>
                  <span className="td-name">{p.person_name}</span>
                  <span className="td-mono" style={{ color: 'var(--text-2)' }}>
                    {p.total_hours.toFixed(1)}h · {p.billable_hours.toFixed(1)}h billable · {formatCurrency(p.total_cost, 'GBP')}
                  </span>
                </summary>
                <div className="overflow-x-auto">
                <table className="data-table" style={{ marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th>Engagement</th>
                      <th style={{ textAlign: 'right' }}>Hours</th>
                      <th style={{ textAlign: 'right' }}>Billable</th>
                      <th style={{ textAlign: 'right' }}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.byEngagement.map((e) => (
                      <tr key={e.engagement_name}>
                        <td className="td-name">{e.engagement_name}</td>
                        <td style={{ textAlign: 'right' }} className="td-mono">{e.hours.toFixed(1)}h</td>
                        <td style={{ textAlign: 'right' }} className="td-mono">{e.billable_hours.toFixed(1)}h</td>
                        <td style={{ textAlign: 'right' }} className="td-mono">{formatCurrency(e.cost, 'GBP')}</td>
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
