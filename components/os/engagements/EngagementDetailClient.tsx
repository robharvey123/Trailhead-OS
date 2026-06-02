'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import type { EngagementDetail } from '@/lib/db/engagements'
import type { Tier1MilestoneWithAccount, TimeEntry } from '@/lib/types'

type Named = { id: string; name: string }
const TABS = ['Overview', 'Time', 'Tier 1', 'Milestones', 'Projects', 'Weekly Updates', 'Documents'] as const
type Tab = (typeof TABS)[number]

const STATUS_CLASS: Record<string, string> = {
  Active: 'status-active', Draft: 'status-on_hold', Paused: 'status-contacted',
  Completed: 'status-listed', Terminated: 'status-declined',
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}

export default function EngagementDetailClient({
  detail,
  timeEntries,
  projects,
  accounts,
}: {
  detail: EngagementDetail
  timeEntries: TimeEntry[]
  projects: Array<{ id: string; name: string; status: string }>
  accounts: Named[]
}) {
  const router = useRouter()
  const e = detail.engagement
  const [tab, setTab] = useState<Tab>('Overview')
  const [milestones, setMilestones] = useState<Tier1MilestoneWithAccount[]>(detail.tier1)
  const [groupByWs, setGroupByWs] = useState(false)
  const [error, setError] = useState('')
  const [addAccountId, setAddAccountId] = useState('')

  const hours = detail.hoursThisMonth
  const pct = hours.pct
  const barColor = pct > 100 ? 'var(--red)' : pct >= 80 ? 'var(--amber)' : 'var(--green)'

  const summary = useMemo(() => {
    const completed = milestones.filter((m) => m.is_complete).length
    const uninvoiced = milestones
      .filter((m) => m.is_complete && !m.fee_invoice_id)
      .reduce((s, m) => s + (m.performance_fee ?? 0), 0)
    return { tracked: milestones.length, completed, uninvoiced }
  }, [milestones])

  async function refreshMilestone(updated: Tier1MilestoneWithAccount) {
    setMilestones((ms) => ms.map((m) => (m.id === updated.id ? { ...m, ...updated, account: m.account } : m)))
  }

  async function setDate(m: Tier1MilestoneWithAccount, field: string, value: string) {
    try {
      const { milestone } = await apiFetch<{ milestone: Tier1MilestoneWithAccount }>(`/api/milestones/${m.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value || null }),
      })
      refreshMilestone(milestone)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to update milestone') }
  }

  async function raiseInvoice(m: Tier1MilestoneWithAccount) {
    try {
      const { invoice } = await apiFetch<{ invoice: { id: string } }>(`/api/milestones/${m.id}/invoice`, { method: 'POST' })
      setMilestones((ms) => ms.map((x) => (x.id === m.id ? { ...x, fee_invoice_id: invoice.id } : x)))
      router.push(`/invoicing/${invoice.id}`)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to raise invoice') }
  }

  async function addTier1() {
    if (!addAccountId) return
    try {
      const { milestones: ms } = await apiFetch<{ milestones: Tier1MilestoneWithAccount[] }>(`/api/engagements/${e.id}/tier1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: addAccountId, performance_fee: e.performance_fee_default }),
      })
      setMilestones(ms)
      setAddAccountId('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add account') }
  }

  async function removeTier1(accountId: string) {
    try {
      await apiFetch(`/api/engagements/${e.id}/tier1?account_id=${accountId}`, { method: 'DELETE' })
      setMilestones((ms) => ms.filter((m) => m.account_id !== accountId))
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to remove account') }
  }

  const dot = (set: boolean) => (
    <span style={{ width: 9, height: 9, borderRadius: '50%', display: 'inline-block', background: set ? 'var(--green)' : 'var(--surface-3)', marginRight: 4 }} />
  )

  const tier1AccountIds = new Set(milestones.map((m) => m.account_id))

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <Link href="/engagements" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ Engagements</Link>
        <span className="topbar-title">{e.name}</span>
        <span className={`status-badge ${STATUS_CLASS[e.status] ?? 'status-on_hold'}`}>{e.status}</span>
        <span className="acct-pill matched">◈ {e.end_client?.name ?? 'End client'}</span>
        {e.billed_via && e.billed_via.id !== e.end_client_account_id ? <span className="acct-pill outbound">via {e.billed_via.name}</span> : null}
        <div className="topbar-actions">
          <span className="meta-chip">{e.retainer_amount_monthly != null ? `${formatCurrency(e.retainer_amount_monthly, e.currency)}/mo` : '—'}</span>
          <span className="meta-chip">{e.day_rate != null ? `${formatCurrency(e.day_rate, e.currency)}/h` : ''}</span>
          <span className="meta-chip">fee {e.performance_fee_default != null ? formatCurrency(e.performance_fee_default, e.currency) : '—'}</span>
        </div>
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '6px 24px' }}>{error}</p> : null}

      <div style={{ padding: 24 }}>
        {/* OVERVIEW */}
        {tab === 'Overview' ? (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
            <div className="card">
              <div className="panel-section-title">This month — hours</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="td-name">{hours.used.toFixed(1)}h / {hours.included ?? '—'}h</span>
                <span className="td-mono" style={{ color: barColor }}>{pct}%</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: barColor }} />
              </div>
              {hours.over > 0 ? <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{hours.over.toFixed(1)}h over cap — triggers approval ({e.approval_thresholds?.hours_overage_hours ?? 0}h threshold)</p> : null}

              <div className="panel-section-title" style={{ marginTop: 18 }}>Workstream split (this month)</div>
              {detail.workstreamSplit.length === 0 ? <p className="field-label">No time logged this month.</p> : detail.workstreamSplit.map((w) => {
                const total = detail.workstreamSplit.reduce((s, x) => s + x.hours, 0) || 1
                const p = Math.round((w.hours / total) * 100)
                return (
                  <div key={w.workstream} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{w.workstream}</span><span className="td-mono">{w.hours.toFixed(1)}h · {p}%</span></div>
                    <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 999, marginTop: 3 }}><div style={{ width: `${p}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} /></div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <div className="panel-section-title">Tier-1 milestones</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div><div className="stat-value" style={{ fontSize: 22 }}>{summary.tracked}</div><div className="field-label">tracked</div></div>
                  <div><div className="stat-value" style={{ fontSize: 22, color: 'var(--green)' }}>{summary.completed}</div><div className="field-label">complete</div></div>
                  <div><div className="stat-value" style={{ fontSize: 22, color: 'var(--emerald)' }}>{formatCurrency(summary.uninvoiced, e.currency)}</div><div className="field-label">uninvoiced</div></div>
                </div>
              </div>
              <div className="card">
                <div className="panel-section-title">Quick actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/weekly-update/new`}>Generate weekly update</Link>
                  <Link className="btn btn-ghost btn-sm" href={`/timesheet`}>+ Log time on this engagement</Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* TIME */}
        {tab === 'Time' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text-2)' }}>
                <input type="checkbox" checked={groupByWs} onChange={(ev) => setGroupByWs(ev.target.checked)} /> Group by workstream
              </label>
            </div>
            {timeEntries.length === 0 ? <div className="empty">No time logged on this engagement yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Workstream</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th></th></tr></thead>
                <tbody>
                  {[...timeEntries]
                    .sort((a, b) => (groupByWs ? (a.workstream ?? '').localeCompare(b.workstream ?? '') : b.entry_date.localeCompare(a.entry_date)))
                    .map((t) => (
                      <tr key={t.id}>
                        <td className="td-mono">{fmtDate(t.entry_date)}</td>
                        <td>{t.workstream ? <span className="channel-tag">{t.workstream}</span> : <span className="td-mono">—</span>}</td>
                        <td>{t.description ?? '—'}</td>
                        <td style={{ textAlign: 'right' }} className="td-mono">{fmtDur(t.duration_minutes)}</td>
                        <td><span className={`pill ${t.billable ? 'billable' : 'nonbill'}`}>{t.billable ? 'Billable' : 'Non-bill'}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* TIER 1 */}
        {tab === 'Tier 1' ? (
          <div>
            <div className="filterbar" style={{ padding: '0 0 12px', border: 'none', background: 'none' }}>
              <select className="filter-select" value={addAccountId} onChange={(ev) => setAddAccountId(ev.target.value)}>
                <option value="">Add account…</option>
                {accounts.filter((a) => !tier1AccountIds.has(a.id)).map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={addTier1} disabled={!addAccountId}>+ Add to Tier 1</button>
            </div>
            {milestones.length === 0 ? <div className="empty">No Tier-1 accounts yet.</div> : (
              <table className="data-table">
                <thead><tr><th>Account</th><th>Channel</th><th>Milestone</th><th style={{ textAlign: 'right' }}>Fee</th><th>Invoice</th><th></th></tr></thead>
                <tbody>
                  {milestones.map((m) => (
                    <tr key={m.id}>
                      <td className="td-name">{m.account?.name ?? '—'}</td>
                      <td>{m.account?.channel ? <span className="channel-tag">{m.account.channel}</span> : '—'}</td>
                      <td>
                        {dot(!!m.range_review_decided_at)}{dot(!!m.go_live_confirmed_at)}{dot(!!m.first_po_received_at)}
                        {m.is_complete ? <span className="pill billable" style={{ marginLeft: 6 }}>complete</span> : null}
                      </td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{m.performance_fee != null ? formatCurrency(m.performance_fee, e.currency) : '—'}</td>
                      <td>{m.fee_invoice_id ? <span className="pill billable">invoiced</span> : m.is_complete ? <span className="pill timer">due</span> : <span className="td-mono">—</span>}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => removeTier1(m.account_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}

        {/* MILESTONES */}
        {tab === 'Milestones' ? (
          milestones.length === 0 ? <div className="empty">Add Tier-1 accounts first.</div> : (
            <div style={{ display: 'grid', gap: 12 }}>
              {milestones.map((m) => (
                <div className="card" key={m.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="td-name">{m.account?.name ?? '—'}</span>
                    {m.is_complete && !m.fee_invoice_id ? (
                      <button className="btn btn-primary btn-sm" onClick={() => raiseInvoice(m)}>Raise {formatCurrency(m.performance_fee ?? 0, e.currency)} invoice</button>
                    ) : m.fee_invoice_id ? <Link className="btn btn-ghost btn-sm" href={`/invoicing/${m.fee_invoice_id}`}>View invoice</Link> : null}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {([['range_review_decided_at', 'Range review decided'], ['go_live_confirmed_at', 'Go-live confirmed'], ['first_po_received_at', 'First PO received']] as const).map(([field, lbl]) => (
                      <div key={field}>
                        <label className="field-label">{lbl}</label>
                        <input type="date" className="filter-select" style={{ width: '100%' }} value={(m[field] as string | null) ?? ''} onChange={(ev) => setDate(m, field, ev.target.value)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : null}

        {/* PROJECTS */}
        {tab === 'Projects' ? (
          projects.length === 0 ? <div className="empty">No projects linked. Link projects from /settings/engagements or the project page.</div> : (
            <table className="data-table">
              <thead><tr><th>Project</th><th>Status</th></tr></thead>
              <tbody>{projects.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/records`)}>
                  <td className="td-name">{p.name}</td><td className="td-mono">{p.status}</td>
                </tr>
              ))}</tbody>
            </table>
          )
        ) : null}

        {/* WEEKLY UPDATES */}
        {tab === 'Weekly Updates' ? (
          <div className="empty">
            <Link className="btn btn-primary btn-sm" href={`/engagements/${e.id}/weekly-update/new`}>Generate this week’s update</Link>
          </div>
        ) : null}

        {/* DOCUMENTS */}
        {tab === 'Documents' ? (
          <div className="empty">Engagement documents (Annex A/B, Tier-1 sub-schedule, signed copies) will live here.</div>
        ) : null}
      </div>
    </div>
  )
}
