'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { formatCurrency } from '@/lib/format'
import type { TimeEntry } from '@/lib/types'

type Named = { id: string; name: string }
type ProjectOpt = Named & { account_id: string | null }

type RangeKey = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'
type Billable = 'all' | 'billable' | 'nonbill'

const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  this_week: 'This week',
  last_week: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom…',
}

function iso(d: Date) {
  return d.toISOString().split('T')[0]
}

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date()
  const startOfWeek = (base: Date) => {
    const d = new Date(base)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }
  switch (key) {
    case 'today':
      return { from: iso(now), to: iso(now) }
    case 'this_week': {
      const s = startOfWeek(now)
      const e = new Date(s)
      e.setDate(s.getDate() + 6)
      return { from: iso(s), to: iso(e) }
    }
    case 'last_week': {
      const s = startOfWeek(now)
      s.setDate(s.getDate() - 7)
      const e = new Date(s)
      e.setDate(s.getDate() + 6)
      return { from: iso(s), to: iso(e) }
    }
    case 'this_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'last_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case 'custom':
      return { from: iso(now), to: iso(now) }
  }
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function TimesheetClient({
  accounts,
  projects,
  initialTimer,
}: {
  accounts: Named[]
  projects: ProjectOpt[]
  initialTimer: TimeEntry | null
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

  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])
  const visibleProjects = useMemo(
    () => (accountId ? projects.filter((p) => p.account_id === accountId) : projects),
    [projects, accountId]
  )

  const activeRange = range === 'custom' ? custom : rangeFor(range)

  const loadEntries = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('date_from', activeRange.from)
      params.set('date_to', activeRange.to)
      params.set('limit', '500')
      if (accountId) params.set('account_id', accountId)
      if (projectId) params.set('project_id', projectId)
      if (billable === 'billable') params.set('billable', 'true')
      if (billable === 'nonbill') params.set('billable', 'false')
      const res = await apiFetch<{ entries: TimeEntry[] }>(`/api/timesheet?${params}`)
      setEntries(res.entries)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries')
    } finally {
      setLoading(false)
    }
  }, [activeRange.from, activeRange.to, accountId, projectId, billable])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  // tick the live timer clock
  useEffect(() => {
    if (!timer?.start_at) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  // Recomputed each render; `tick` (1s interval) drives the re-render while a timer runs.
  const elapsedSeconds =
    timer?.start_at && tick > -1
      ? Math.max(0, Math.floor((Date.now() - new Date(timer.start_at).getTime()) / 1000))
      : 0

  const totals = useMemo(() => {
    const today = iso(new Date())
    let minutes = 0, amount = 0, billableMinutes = 0, todayMinutes = 0, todayAmount = 0
    const byClient = new Map<string, number>()
    for (const e of entries) {
      minutes += e.duration_minutes
      if (e.billable) {
        billableMinutes += e.duration_minutes
        amount += (e.duration_minutes / 60) * e.rate_snapshot
      }
      if (e.entry_date === today) {
        todayMinutes += e.duration_minutes
        if (e.billable) todayAmount += (e.duration_minutes / 60) * e.rate_snapshot
      }
      if (e.account_id) byClient.set(e.account_id, (byClient.get(e.account_id) ?? 0) + e.duration_minutes)
    }
    let topClient: { name: string; minutes: number } | null = null
    for (const [id, mins] of byClient) {
      if (!topClient || mins > topClient.minutes) topClient = { name: accountName.get(id) ?? 'Unknown', minutes: mins }
    }
    const billableRate = minutes > 0 ? Math.round((billableMinutes / minutes) * 100) : 0
    return { minutes, amount, billableMinutes, billableRate, todayMinutes, todayAmount, topClient }
  }, [entries, accountName])

  async function startTimer() {
    try {
      const { timer: started } = await apiFetch<{ timer: TimeEntry }>('/api/timesheet/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId || null, project_id: projectId || null }),
      })
      setTimer(started)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start timer')
    }
  }

  async function stopTimer() {
    if (!timer) return
    try {
      await apiFetch(`/api/timesheet/timer/${timer.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rate_snapshot: timer.rate_snapshot || 0 }),
      })
      setTimer(null)
      loadEntries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop timer')
    }
  }

  const segBtn = (val: Billable, label: string) => (
    <button className={billable === val ? 'active' : ''} onClick={() => setBillable(val)}>{label}</button>
  )

  return (
    <div className="panel overflow-hidden">
      {/* topbar with live timer */}
      <div className="topbar">
        <span className="topbar-title">Timesheet</span>
        <span className="topbar-count">{RANGE_LABELS[range]}</span>
        <div className="topbar-actions">
          {timer ? (
            <div className="timer">
              <span className="timer-dot" />
              <div className="timer-meta">
                <b>{timer.account_id ? accountName.get(timer.account_id) ?? 'No client' : 'No client'}</b>
                <br />
                <span>{timer.project_id ? projectName.get(timer.project_id) ?? '' : 'No project'}</span>
              </div>
              <div className="timer-clock">{fmtClock(elapsedSeconds)}</div>
              <button className="timer-stop" onClick={stopTimer} title="Stop">■</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={startTimer}>▶ Start timer</button>
          )}
        </div>
      </div>

      {/* stats strip */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-label">Today</div>
          <div className="stat-value">{fmtDur(totals.todayMinutes)}</div>
          <div className="stat-sub">{formatCurrency(totals.todayAmount, 'GBP')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">{RANGE_LABELS[range].replace('…', '')}</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{fmtDur(totals.minutes)}</div>
          <div className="stat-sub">{formatCurrency(totals.amount, 'GBP')}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Billable this range</div>
          <div className="stat-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(totals.amount, 'GBP')}</div>
          <div className="stat-sub">{totals.billableRate}% billable</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Top client</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{totals.topClient?.name ?? '—'}</div>
          <div className="stat-sub">{totals.topClient ? fmtDur(totals.topClient.minutes) : ''}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Active timer</div>
          <div className="stat-value" style={{ color: timer ? 'var(--red)' : 'var(--text-3)', fontSize: 16 }}>
            {timer ? '● Running' : '—'}
          </div>
          <div className="stat-sub">{timer?.start_at ? `since ${new Date(timer.start_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
        </div>
      </div>

      {/* filter bar */}
      <div className="filterbar">
        <div className="range-chips">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((k) => (
            <button key={k} className={`range-chip ${range === k ? 'active' : ''}`} onClick={() => setRange(k)}>
              {RANGE_LABELS[k]}
            </button>
          ))}
        </div>
        {range === 'custom' ? (
          <>
            <input type="date" className="filter-select" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <input type="date" className="filter-select" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </>
        ) : null}
        <select className="filter-select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setProjectId('') }}>
          <option value="">All clients</option>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        <select className="filter-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {visibleProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
        <div className="seg-toggle">
          {segBtn('all', 'All')}
          {segBtn('billable', 'Billable')}
          {segBtn('nonbill', 'Non-billable')}
        </div>
      </div>

      {error ? <p style={{ color: 'var(--red)', fontSize: 12, padding: '8px 24px' }}>{error}</p> : null}

      {/* entries table */}
      <div style={{ overflowX: 'auto' }}>
        {loading ? (
          <div className="empty">Loading entries…</div>
        ) : entries.length === 0 && !timer ? (
          <div className="empty">No time entries in this range.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Account</th><th>Project</th><th>Description</th>
                <th style={{ textAlign: 'right' }}>Duration</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {timer ? (
                <tr className="row-running">
                  <td className="td-mono">Now</td>
                  <td className="td-name">{timer.account_id ? accountName.get(timer.account_id) ?? '—' : '—'}</td>
                  <td className="td-mono">{timer.project_id ? projectName.get(timer.project_id) ?? '—' : '—'}</td>
                  <td>{timer.description ?? 'Running timer'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{fmtClock(elapsedSeconds)} <span className="pill timer" style={{ marginLeft: 6 }}>● live</span></td>
                  <td style={{ textAlign: 'right' }} className="td-mono">—</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">—</td>
                  <td></td>
                </tr>
              ) : null}
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="td-mono">{new Date(e.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                  <td className="td-name">{e.account_id ? accountName.get(e.account_id) ?? '—' : '—'}</td>
                  <td className="td-mono">{e.project_id ? projectName.get(e.project_id) ?? '—' : '—'}</td>
                  <td>{e.description ?? '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{fmtDur(e.duration_minutes)}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{e.rate_snapshot ? `${formatCurrency(e.rate_snapshot, e.currency_snapshot || 'GBP')}/h` : '—'}</td>
                  <td style={{ textAlign: 'right' }} className="td-mono">{e.billable ? formatCurrency((e.duration_minutes / 60) * e.rate_snapshot, e.currency_snapshot || 'GBP') : '—'}</td>
                  <td><span className={`pill ${e.billable ? 'billable' : 'nonbill'}`}>{e.billable ? 'Billable' : 'Non-bill'}</span></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="total-label" colSpan={4}>Total · {RANGE_LABELS[range].replace('…', '')}</td>
                <td className="total-val" style={{ textAlign: 'right' }}>{fmtDur(totals.minutes)}</td>
                <td></td>
                <td className="total-amount" style={{ textAlign: 'right' }}>{formatCurrency(totals.amount, 'GBP')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
