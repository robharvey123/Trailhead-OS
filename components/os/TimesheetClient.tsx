'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import type { TimeEntry } from '@/lib/types'
import TimeEntryForm, { type EngagementOption } from './TimeEntryForm'

export type { EngagementOption }

type Named = { id: string; name: string }
type ProjectOpt = Named & { account_id: string | null }

type RangeKey = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'
type Billable = 'all' | 'billable' | 'nonbill'

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today', this_week: 'This week', last_week: 'Last week',
  this_month: 'This month', last_month: 'Last month', custom: 'Custom…',
}

function iso(d: Date) { return d.toISOString().split('T')[0] }

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date()
  const startOfWeek = (base: Date) => {
    const d = new Date(base)
    const day = d.getDay()
    return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)))
  }
  switch (key) {
    case 'today': return { from: iso(now), to: iso(now) }
    case 'this_week': { const s = startOfWeek(now); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: iso(s), to: iso(e) } }
    case 'last_week': { const s = startOfWeek(now); s.setDate(s.getDate() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: iso(s), to: iso(e) } }
    case 'this_month': return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'last_month': return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case 'custom': return { from: iso(now), to: iso(now) }
  }
}

function fmtDur(min: number) { const h = Math.floor(min / 60), m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m` }
function fmtClock(s: number) { return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':') }

export default function TimesheetClient({
  accounts, projects, initialTimer, engagements,
}: {
  accounts: Named[]
  projects: ProjectOpt[]
  initialTimer: TimeEntry | null
  engagements: EngagementOption[]
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [range, setRange] = useState<RangeKey>('this_week')
  const [custom, setCustom] = useState(rangeFor('this_week'))
  const [accountId, setAccountId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [billable, setBillable] = useState<Billable>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [timer, setTimer] = useState<TimeEntry | null>(initialTimer)
  const [tick, setTick] = useState(0)
  const [timerEngagement, setTimerEngagement] = useState('')
  const [engHours, setEngHours] = useState<Record<string, number>>(
    () => Object.fromEntries(engagements.map((e) => [e.id, e.hours_used_mtd]))
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [capToast, setCapToast] = useState<{ msg: string; level: 'amber' | 'red' } | null>(null)

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const engById = useMemo(() => new Map(engagements.map((e) => [e.id, e])), [engagements])
  const visibleProjects = useMemo(() => (accountId ? projects.filter((p) => p.account_id === accountId) : projects), [projects, accountId])

  const activeRange = range === 'custom' ? custom : rangeFor(range)

  const loadEntries = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      params.set('date_from', activeRange.from); params.set('date_to', activeRange.to); params.set('limit', '500')
      if (accountId) params.set('account_id', accountId)
      if (projectId) params.set('project_id', projectId)
      if (billable === 'billable') params.set('billable', 'true')
      if (billable === 'nonbill') params.set('billable', 'false')
      const res = await apiFetch<{ entries: TimeEntry[] }>(`/api/timesheet?${params}`)
      setEntries(res.entries)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load entries') } finally { setLoading(false) }
  }, [activeRange.from, activeRange.to, accountId, projectId, billable])

  useEffect(() => { loadEntries() }, [loadEntries])

  useEffect(() => {
    if (!timer?.start_at) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  const elapsedSeconds = timer?.start_at && tick > -1
    ? Math.max(0, Math.floor((Date.now() - new Date(timer.start_at).getTime()) / 1000))
    : 0

  const totals = useMemo(() => {
    const today = iso(new Date())
    let minutes = 0, amount = 0, billableMinutes = 0, todayMinutes = 0, todayAmount = 0
    const byClient = new Map<string, number>()
    for (const e of entries) {
      minutes += e.duration_minutes
      if (e.billable) { billableMinutes += e.duration_minutes; amount += (e.duration_minutes / 60) * e.rate_snapshot }
      if (e.entry_date === today) { todayMinutes += e.duration_minutes; if (e.billable) todayAmount += (e.duration_minutes / 60) * e.rate_snapshot }
      if (e.account_id) byClient.set(e.account_id, (byClient.get(e.account_id) ?? 0) + e.duration_minutes)
    }
    let topClient: { name: string; minutes: number } | null = null
    for (const [id, mins] of byClient) if (!topClient || mins > topClient.minutes) topClient = { name: accountName.get(id) ?? 'Unknown', minutes: mins }
    return { minutes, amount, billableRate: minutes > 0 ? Math.round((billableMinutes / minutes) * 100) : 0, todayMinutes, todayAmount, topClient }
  }, [entries, accountName])

  // Most-loaded active engagement for the caps tile.
  const capLeader = useMemo(() => {
    let best: { e: EngagementOption; used: number; pct: number } | null = null
    for (const e of engagements) {
      if (!e.included_hours_monthly) continue
      const used = engHours[e.id] ?? 0
      const pct = Math.round((used / e.included_hours_monthly) * 100)
      if (!best || pct > best.pct) best = { e, used, pct }
    }
    return best
  }, [engagements, engHours])

  async function refreshEngagement(engagementId: string) {
    try {
      const detail = await apiFetch<{ hoursThisMonth: { used: number; pct: number; included: number | null } }>(`/api/engagements/${engagementId}`)
      const { used, pct, included } = detail.hoursThisMonth
      setEngHours((m) => ({ ...m, [engagementId]: used }))
      const e = engById.get(engagementId)
      if (pct >= 100) setCapToast({ level: 'red', msg: `${e?.name ?? 'Engagement'}: ${pct}% of monthly hours used (${used.toFixed(1)} / ${included ?? '—'}) — over cap triggers approval.` })
      else if (pct >= 80) setCapToast({ level: 'amber', msg: `${e?.name ?? 'Engagement'}: ${pct}% of monthly hours used (${used.toFixed(1)} / ${included ?? '—'}).` })
    } catch { /* non-fatal */ }
  }

  async function startTimer() {
    try {
      const eng = engById.get(timerEngagement)
      const { timer: started } = await apiFetch<{ timer: TimeEntry }>('/api/timesheet/timer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: eng?.account_id ?? accountId ?? null, engagement_id: timerEngagement || null }),
      })
      setTimer(started)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to start timer') }
  }

  async function stopTimer() {
    if (!timer) return
    const engId = timer.engagement_id
    try {
      await apiFetch(`/api/timesheet/timer/${timer.id}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate_snapshot: timer.rate_snapshot || 0 }) })
      setTimer(null)
      await loadEntries()
      if (engId) await refreshEngagement(engId)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to stop timer') }
  }

  async function onSaved(entry: TimeEntry) {
    await loadEntries()
    if (entry.engagement_id) await refreshEngagement(entry.engagement_id)
  }
  async function onDeleted(_id: string, engagementId?: string | null) {
    await loadEntries()
    if (engagementId) await refreshEngagement(engagementId)
  }

  async function quickDelete(e: TimeEntry) {
    if (e.is_running) { setError('Stop the running timer before deleting it.'); return }
    if (!confirm(`Delete this entry? ${fmtDur(e.duration_minutes)} on ${accountName.get(e.account_id ?? '') ?? 'no account'}`)) return
    try {
      await apiFetch(`/api/timesheet/${e.id}`, { method: 'DELETE' })
      await onDeleted(e.id, e.engagement_id)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete entry') }
  }

  function openEdit(e: TimeEntry) {
    if (e.is_running) { setError('This entry is a running timer — stop it first to edit.'); return }
    setEditing(e); setFormOpen(true)
  }

  const segBtn = (val: Billable, label: string) => (
    <button className={billable === val ? 'active' : ''} onClick={() => setBillable(val)}>{label}</button>
  )

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <span className="topbar-title">Timesheet</span>
        <span className="topbar-count">{RANGE_LABELS[range]}</span>
        <div className="topbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(null); setFormOpen(true) }}>+ Add entry</button>
          {timer ? (
            <div className="timer">
              <span className="timer-dot" />
              <div className="timer-meta">
                <b>{timer.account_id ? accountName.get(timer.account_id) ?? 'No client' : 'No client'}</b><br />
                <span>{timer.engagement_id ? engById.get(timer.engagement_id)?.name ?? '' : timer.workstream ?? 'No engagement'}</span>
              </div>
              <div className="timer-clock">{fmtClock(elapsedSeconds)}</div>
              <button className="timer-stop" onClick={stopTimer} title="Stop">■</button>
            </div>
          ) : (
            <>
              <select className="filter-select" value={timerEngagement} onChange={(e) => setTimerEngagement(e.target.value)}>
                <option value="">Timer: no engagement</option>
                {engagements.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={startTimer}>▶ Start timer</button>
            </>
          )}
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item"><div className="stat-label">Today</div><div className="stat-value">{fmtDur(totals.todayMinutes)}</div><div className="stat-sub">{formatCurrency(totals.todayAmount, 'GBP')}</div></div>
        <div className="stat-item"><div className="stat-label">{RANGE_LABELS[range].replace('…', '')}</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{fmtDur(totals.minutes)}</div><div className="stat-sub">{formatCurrency(totals.amount, 'GBP')}</div></div>
        <div className="stat-item"><div className="stat-label">Billable this range</div><div className="stat-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(totals.amount, 'GBP')}</div><div className="stat-sub">{totals.billableRate}% billable</div></div>
        <div className="stat-item"><div className="stat-label">Top client</div><div className="stat-value" style={{ fontSize: 16 }}>{totals.topClient?.name ?? '—'}</div><div className="stat-sub">{totals.topClient ? fmtDur(totals.topClient.minutes) : ''}</div></div>
        {capLeader ? (
          <Link className="stat-item" href={`/engagements/${capLeader.e.id}`} style={{ textDecoration: 'none' }}>
            <div className="stat-label">Engagement caps</div>
            <div className="stat-value" style={{ fontSize: 15, color: capLeader.pct > 100 ? 'var(--red)' : capLeader.pct >= 80 ? 'var(--amber)' : 'var(--text)' }}>
              {capLeader.e.name.split(' ')[0]}: {capLeader.used.toFixed(0)}/{capLeader.e.included_hours_monthly}h
            </div>
            <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 999, marginTop: 6 }}>
              <div style={{ width: `${Math.min(100, capLeader.pct)}%`, height: '100%', borderRadius: 999, background: capLeader.pct > 100 ? 'var(--red)' : capLeader.pct >= 80 ? 'var(--amber)' : 'var(--green)' }} />
            </div>
          </Link>
        ) : (
          <div className="stat-item"><div className="stat-label">Engagement caps</div><div className="stat-value" style={{ fontSize: 15, color: 'var(--text-3)' }}>—</div></div>
        )}
      </div>

      {capToast ? (
        <div style={{ padding: '8px 24px', background: capToast.level === 'red' ? 'var(--red-dim)' : 'var(--amber-dim)', borderBottom: `1px solid ${capToast.level === 'red' ? 'var(--red)' : 'var(--amber)'}`, color: capToast.level === 'red' ? 'var(--red)' : 'var(--amber)', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
          <span>{capToast.msg}</span>
          <button onClick={() => setCapToast(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>✕</button>
        </div>
      ) : null}

      <div className="filterbar">
        <div className="range-chips">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (<button key={k} className={`range-chip ${range === k ? 'active' : ''}`} onClick={() => setRange(k)}>{RANGE_LABELS[k]}</button>))}
        </div>
        {range === 'custom' ? (<>
          <input type="date" className="filter-select" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <input type="date" className="filter-select" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </>) : null}
        <select className="filter-select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setProjectId('') }}>
          <option value="">All clients</option>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <select className="filter-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {visibleProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <div className="seg-toggle">{segBtn('all', 'All')}{segBtn('billable', 'Billable')}{segBtn('nonbill', 'Non-billable')}</div>
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '8px 24px' }}>{error}</p> : null}

      <div style={{ overflowX: 'auto' }}>
        {loading ? <div className="empty">Loading entries…</div> : entries.length === 0 && !timer ? <div className="empty">No time entries in this range.</div> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Account</th><th>Engagement</th><th>Workstream</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th style={{ textAlign: 'right' }}>Amount</th><th></th><th></th></tr></thead>
            <tbody>
              {timer ? (
                <tr className="row-running">
                  <td className="td-mono">Now</td>
                  <td className="td-name">{timer.account_id ? accountName.get(timer.account_id) ?? '—' : '—'}</td>
                  <td className="td-mono">{timer.engagement_id ? engById.get(timer.engagement_id)?.name ?? '—' : '—'}</td>
                  <td>{timer.workstream ? <span className="channel-tag">{timer.workstream}</span> : '—'}</td>
                  <td>{timer.description ?? 'Running timer'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{fmtClock(elapsedSeconds)} <span className="pill timer" style={{ marginLeft: 6 }}>● live</span></td>
                  <td style={{ textAlign: 'right' }} className="td-mono">—</td>
                  <td colSpan={2}></td>
                </tr>
              ) : null}
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="td-mono" style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>{new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  <td className="td-name" style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>{e.account_id ? accountName.get(e.account_id) ?? '—' : '—'}</td>
                  <td className="td-mono">{e.engagement_id ? engById.get(e.engagement_id)?.name ?? '—' : '—'}</td>
                  <td>{e.workstream ? <span className="channel-tag">{e.workstream}</span> : <span className="td-mono">—</span>}</td>
                  <td style={{ cursor: 'pointer' }} onClick={() => openEdit(e)}>{e.description ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{fmtDur(e.duration_minutes)}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{e.billable ? formatCurrency((e.duration_minutes / 60) * e.rate_snapshot, e.currency_snapshot || 'GBP') : '—'}</td>
                  <td><span className={`pill ${e.billable ? 'billable' : 'nonbill'}`}>{e.billable ? 'Billable' : 'Non-bill'}</span></td>
                  <td><button className="btn btn-ghost btn-sm" title="Delete" onClick={() => quickDelete(e)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td className="total-label" colSpan={5}>Total · {RANGE_LABELS[range].replace('…', '')}</td><td className="total-val" style={{ textAlign: 'right' }}>{fmtDur(totals.minutes)}</td><td className="total-amount" style={{ textAlign: 'right' }}>{formatCurrency(totals.amount, 'GBP')}</td><td colSpan={2}></td></tr></tfoot>
          </table>
        )}
      </div>

      {formOpen ? (
        <TimeEntryForm
          entry={editing}
          accounts={accounts}
          projects={projects}
          engagements={engagements}
          onClose={() => setFormOpen(false)}
          onSaved={onSaved}
          onDeleted={(id) => onDeleted(id, editing?.engagement_id)}
        />
      ) : null}
    </div>
  )
}
