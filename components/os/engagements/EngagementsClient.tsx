'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import type { EngagementWithRelations } from '@/lib/types'

const STATUS_CLASS: Record<string, string> = {
  Active: 'status-active', Draft: 'status-on_hold', Paused: 'status-contacted',
  Completed: 'status-listed', Terminated: 'status-declined',
}

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export default function EngagementsClient({
  engagements,
  hoursMap,
  milestonesCompletedThisMonth,
}: {
  engagements: EngagementWithRelations[]
  hoursMap: Record<string, number>
  milestonesCompletedThisMonth: number
}) {
  const router = useRouter()

  const stats = useMemo(() => {
    const active = engagements.filter((e) => e.status === 'Active')
    const mtdHours = engagements.reduce((s, e) => s + (hoursMap[e.id] ?? 0), 0)
    const mtdRetainer = active.reduce((s, e) => s + (e.retainer_amount_monthly ?? 0), 0)
    return { active: active.length, mtdHours, mtdRetainer }
  }, [engagements, hoursMap])

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <span className="topbar-title">Engagements</span>
        <span className="topbar-count">{engagements.length}</span>
        <div className="topbar-actions">
          <Link className="btn btn-primary btn-sm" href="/engagements/new">+ New engagement</Link>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item"><div className="stat-label">Active engagements</div><div className="stat-value">{stats.active}</div></div>
        <div className="stat-item"><div className="stat-label">MTD hours used</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.mtdHours.toFixed(1)}h</div></div>
        <div className="stat-item"><div className="stat-label">MTD retainer</div><div className="stat-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(stats.mtdRetainer, 'GBP')}</div></div>
        <div className="stat-item"><div className="stat-label">Tier-1 complete this month</div><div className="stat-value">{milestonesCompletedThisMonth}</div></div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>End client</th><th>Billed via</th><th>Status</th>
              <th style={{ textAlign: 'right' }}>Hours (mo)</th>
              <th style={{ textAlign: 'right' }}>Retainer</th>
              <th>Term ends</th>
            </tr>
          </thead>
          <tbody>
            {engagements.length === 0 ? (
              <tr><td colSpan={7} className="empty">No engagements yet. Create your first.</td></tr>
            ) : (
              engagements.map((e) => {
                const used = hoursMap[e.id] ?? 0
                const inc = e.included_hours_monthly
                const over = inc != null && used > inc
                return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/engagements/${e.id}`)}>
                    <td>
                      <div className="td-name">{e.name}</div>
                      {e.code ? <div className="td-sub">{e.code}</div> : null}
                    </td>
                    <td className="td-name">{e.end_client?.name ?? '—'}</td>
                    <td className="td-mono">{e.billed_via?.name ?? 'direct'}</td>
                    <td><span className={`status-badge ${STATUS_CLASS[e.status] ?? 'status-on_hold'}`}>{e.status}</span></td>
                    <td style={{ textAlign: 'right' }} className="td-mono">
                      <span style={{ color: over ? 'var(--red)' : 'var(--text)' }}>{used.toFixed(1)}</span>
                      {inc != null ? <span style={{ color: 'var(--text-3)' }}> / {inc}</span> : null}
                    </td>
                    <td style={{ textAlign: 'right' }} className="td-mono">{e.retainer_amount_monthly != null ? formatCurrency(e.retainer_amount_monthly, e.currency || 'GBP') : '—'}</td>
                    <td className="td-mono">{fmtDate(e.end_date)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
