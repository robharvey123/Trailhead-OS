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
    <div className="p-6">
      <div className="mb-2.5 flex justify-end">
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
                <th className="text-right!">Total hours</th>
                <th className="text-right!">Billable hours</th>
                <th className="text-right!">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = r.engagement_id ?? 'none'
                const expanded = open.has(key)
                return [
                  <tr key={key} className="cursor-pointer" onClick={() => toggle(key)}>
                    <td className="td-name">
                      <span className="inline-block w-4 text-[var(--text-3)]">{expanded ? '▾' : '▸'}</span>
                      {r.engagement_id ? (
                        <Link href={`/engagements/${r.engagement_id}?tab=Time`} onClick={(e) => e.stopPropagation()}>
                          {r.engagement_name}
                        </Link>
                      ) : (
                        r.engagement_name
                      )}
                    </td>
                    <td className="td-num text-right">{r.total_hours.toFixed(1)}h</td>
                    <td className="td-num text-right">{r.billable_hours.toFixed(1)}h</td>
                    <td className="td-num text-right">{formatCurrency(r.total_cost, 'GBP')}</td>
                  </tr>,
                  billingMonths && r.months.length > 0 ? (
                    <tr key={`${key}-months`}>
                      <td colSpan={4} className="bg-[var(--surface-2)] pb-2.5! pl-7! pr-3! pt-1!">
                        {r.months.map((m) => (
                          <div key={m.period_start} className="flex justify-between gap-3 py-0.5 text-xs">
                            {r.engagement_id ? (
                              <Link href={`/engagements/${r.engagement_id}?tab=Time&period=${m.period_start}`}>{m.label}</Link>
                            ) : (
                              <span>{m.label}</span>
                            )}
                            <span className="td-num">
                              {m.hours.toFixed(1)}{m.included != null ? ` / ${m.included}h` : 'h'} · {formatCurrency(m.amount, 'GBP')}
                            </span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  ) : null,
                  expanded ? (
                    <tr key={`${key}-detail`}>
                      <td colSpan={4} className="bg-[var(--surface-2)] pb-3! pl-7! pr-3! pt-1.5!">
                        <div className="flex flex-wrap gap-10">
                          {([['By project', r.by_project], ['By person', r.by_person]] as const).map(([title, groups]) => (
                            <div key={title} className="min-w-[220px]">
                              <div className="field-label">{title}</div>
                              {groups.map((g) => (
                                <div key={`${g.id}:${g.name}`} className="flex justify-between gap-3 py-0.5 text-xs">
                                  <span>{g.name}</span>
                                  <span className="td-num">{g.hours.toFixed(1)}h · {formatCurrency(g.amount, 'GBP')}</span>
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
                <td className="total-val text-right">{totals.hours.toFixed(1)}h</td>
                <td className="total-val text-right">{totals.billable.toFixed(1)}h</td>
                <td className="total-amount text-right">{formatCurrency(totals.cost, 'GBP')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
