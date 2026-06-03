import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hoursByEngagement } from '@/lib/db/reports'
import { formatCurrency } from '@/lib/format'
import { mockupFontVars } from '@/lib/fonts'

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
  const totals = rows.reduce(
    (a, r) => ({ hours: a.hours + r.total_hours, billable: a.billable + r.billable_hours, cost: a.cost + r.total_cost }),
    { hours: 0, billable: 0, cost: 0 }
  )

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

        <div style={{ padding: 24 }}>
          {rows.length === 0 ? (
            <div className="empty">No time logged in this range.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Engagement</th>
                  <th style={{ textAlign: 'right' }}>Total hours</th>
                  <th style={{ textAlign: 'right' }}>Billable hours</th>
                  <th style={{ textAlign: 'right' }}>Total cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.engagement_id ?? 'none'}>
                    <td className="td-name">
                      {r.engagement_id ? <Link href={`/engagements/${r.engagement_id}`}>{r.engagement_name}</Link> : r.engagement_name}
                    </td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{r.total_hours.toFixed(1)}h</td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{r.billable_hours.toFixed(1)}h</td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{formatCurrency(r.total_cost, 'GBP')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="total-label">Total</td>
                  <td className="total-val" style={{ textAlign: 'right' }}>{totals.hours.toFixed(1)}h</td>
                  <td className="total-val" style={{ textAlign: 'right' }}>{totals.billable.toFixed(1)}h</td>
                  <td className="total-amount" style={{ textAlign: 'right' }}>{formatCurrency(totals.cost, 'GBP')}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
