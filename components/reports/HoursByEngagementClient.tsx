'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/format'
import type { HoursByEngagementRow } from '@/lib/db/reports'

// Hours-by-engagement table: expandable per-engagement project/person sub-rows,
// and a Billing-months toggle that buckets the range by each engagement's own
// anchor day (used / included per month). Deep-links into the Time tab.

export default function HoursByEngagementClient({ rows }: { rows: HoursByEngagementRow[] }) {
  const [billingMonths, setBillingMonths] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const totals = rows.reduce(
    (a, r) => ({ hours: a.hours + r.total_hours, billable: a.billable + r.billable_hours, cost: a.cost + r.total_cost }),
    { hours: 0, billable: 0, cost: 0 }
  )

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <div className="seg-toggle">
          <button className={billingMonths ? '' : 'active'} onClick={() => setBillingMonths(false)}>Totals</button>
          <button className={billingMonths ? 'active' : ''} onClick={() => setBillingMonths(true)}>Billing months</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="empty">No time logged in this range.</div>
      ) : (
        <div className="overflow-x-auto">
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
              {rows.map((r) => {
                const key = r.engagement_id ?? 'none'
                const expanded = open.has(key)
                return [
                  <tr key={key} style={{ cursor: 'pointer' }} onClick={() => toggle(key)}>
                    <td className="td-name">
                      <span style={{ display: 'inline-block', width: 16, color: 'var(--text-3)' }}>{expanded ? '▾' : '▸'}</span>
                      {r.engagement_id ? (
                        <Link href={`/engagements/${r.engagement_id}?tab=Time`} onClick={(e) => e.stopPropagation()}>
                          {r.engagement_name}
                        </Link>
                      ) : (
                        r.engagement_name
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{r.total_hours.toFixed(1)}h</td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{r.billable_hours.toFixed(1)}h</td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{formatCurrency(r.total_cost, 'GBP')}</td>
                  </tr>,
                  billingMonths && r.months.length > 0 ? (
                    <tr key={`${key}-months`}>
                      <td colSpan={4} style={{ padding: '4px 12px 10px 28px', background: 'var(--surface-2)' }}>
                        {r.months.map((m) => (
                          <div key={m.period_start} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '2px 0' }}>
                            {r.engagement_id ? (
                              <Link href={`/engagements/${r.engagement_id}?tab=Time&period=${m.period_start}`}>{m.label}</Link>
                            ) : (
                              <span>{m.label}</span>
                            )}
                            <span className="td-mono">
                              {m.hours.toFixed(1)}{m.included != null ? ` / ${m.included}h` : 'h'} · {formatCurrency(m.amount, 'GBP')}
                            </span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ) : null,
                  expanded ? (
                    <tr key={`${key}-detail`}>
                      <td colSpan={4} style={{ padding: '6px 12px 12px 28px', background: 'var(--surface-2)' }}>
                        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                          {([['By project', r.by_project], ['By person', r.by_person]] as const).map(([title, groups]) => (
                            <div key={title} style={{ minWidth: 220 }}>
                              <div className="field-label" style={{ marginBottom: 4 }}>{title}</div>
                              {groups.map((g) => (
                                <div key={`${g.id}:${g.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, padding: '2px 0' }}>
                                  <span>{g.name}</span>
                                  <span className="td-mono">{g.hours.toFixed(1)}h · {formatCurrency(g.amount, 'GBP')}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
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
        </div>
      )}
    </div>
  )
}
