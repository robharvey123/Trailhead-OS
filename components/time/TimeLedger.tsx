'use client'

// The shared time-entries ledger: engagement Time tab and project Time panel
// both render this, so the two surfaces can never disagree. Grouped by billing
// month (the engagement's own anchor day; calendar months when there is no
// engagement), with one set of maths from lib/time/summary.

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/format'
import { isAttributed } from '@/lib/engagements/client-safe'
import { formatBillingPeriod, type BillingPeriodBasis } from '@/lib/engagements/periods'
import { bucketByBillingMonth, summariseTime } from '@/lib/time/summary'
import type { TimeEntryLedgerRow } from '@/lib/types'
import type { TimeEntryFormOptions } from '@/components/os/TimeEntryForm'
import StartTimerButton from './StartTimerButton'
import LogTimeButton from './LogTimeButton'

const TimeEntryForm = dynamic(() => import('@/components/os/TimeEntryForm'), { ssr: false })

function fmtDur(min: number) { const h = Math.floor(min / 60), m = min % 60; return h > 0 ? `${h}h ${m}m` : `${m}m` }
function fmtDate(v: string) { return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }

export type TimeLedgerEngagement = {
  id: string
  code: string | null
  name: string
  included_hours_monthly: number | null
  end_client_account_id: string | null
  start_date: string | null
  billing_month_start_day: number | null
}

export default function TimeLedger({
  rows,
  scope,
  engagement = null,
  hoursThisMonth = null,
  noEngagementNote = null,
  initialPeriod = null,
}: {
  rows: TimeEntryLedgerRow[]
  scope: { engagement_id?: string; project_id?: string }
  engagement?: TimeLedgerEngagement | null
  hoursThisMonth?: { used: number; included: number | null; pct: number } | null
  /** Amber line shown when a project has no engagement. */
  noEngagementNote?: string | null
  /** Preselect a billing-month chip (period start date, from ?period=). */
  initialPeriod?: string | null
}) {
  const router = useRouter()
  const basis: BillingPeriodBasis = useMemo(
    () =>
      engagement
        ? { start_date: engagement.start_date, billing_month_start_day: engagement.billing_month_start_day }
        : { start_date: null, billing_month_start_day: 1 },
    [engagement]
  )

  const [period, setPeriod] = useState<string>(initialPeriod ?? 'all')
  const [projectFilter, setProjectFilter] = useState('')
  const [personFilter, setPersonFilter] = useState('')
  const [taskFilter, setTaskFilter] = useState('')
  const [billableFilter, setBillableFilter] = useState('')
  const [billedFilter, setBilledFilter] = useState('')
  const [unattributedOnly, setUnattributedOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<TimeEntryLedgerRow | null>(null)
  const [options, setOptions] = useState<TimeEntryFormOptions | null>(null)

  // Would this row print as "(unattributed time)" on a client artefact? Same
  // pure chain the exports use: entry client line, then the task's.
  const rowAttributed = (r: TimeEntryLedgerRow) =>
    isAttributed({
      entry_client_description: r.client_description,
      task_client_description: r.task?.client_description ?? null,
      task_title: r.task?.title ?? null,
    })

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (projectFilter && r.project_id !== projectFilter) return false
        if (personFilter && r.person_id !== personFilter) return false
        if (taskFilter && r.task_id !== taskFilter) return false
        if (billableFilter && String(r.billable) !== billableFilter) return false
        if (billedFilter && String(Boolean(r.billed)) !== billedFilter) return false
        if (unattributedOnly && rowAttributed(r)) return false
        return true
      }),
     
    [rows, projectFilter, personFilter, taskFilter, billableFilter, billedFilter, unattributedOnly]
  )

  const unattributed = useMemo(() => {
    const list = rows.filter((r) => !rowAttributed(r))
    return { count: list.length, hours: Math.round((list.reduce((s, r) => s + r.duration_minutes, 0) / 60) * 10) / 10 }
     
  }, [rows])

  const allBuckets = useMemo(() => bucketByBillingMonth(filtered, basis), [filtered, basis])
  const buckets = period === 'all' ? allBuckets : allBuckets.filter((b) => b.period.start === period)
  const visibleRows = useMemo(() => buckets.flatMap((b) => b.rows), [buckets])
  const selectedSummary = useMemo(() => summariseTime(visibleRows), [visibleRows])
  const allTime = useMemo(() => summariseTime(rows), [rows])
  const prevBucket = allBuckets[1] ?? null

  const filterOptions = useMemo(() => {
    const projects = new Map<string, string>(), people = new Map<string, string>(), tasks = new Map<string, string>()
    for (const r of rows) {
      if (r.project) projects.set(r.project.id, r.project.name)
      if (r.person) people.set(r.person.id, r.person.full_name)
      if (r.task) tasks.set(r.task.id, r.task.title)
    }
    const sorted = (m: Map<string, string>) => [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    return { projects: sorted(projects), people: sorted(people), tasks: sorted(tasks) }
  }, [rows])

  async function ensureOptions(): Promise<TimeEntryFormOptions | null> {
    if (options) return options
    try {
      const res = await fetch('/api/timesheet/options')
      if (!res.ok) return null
      const loaded = (await res.json()) as TimeEntryFormOptions
      setOptions(loaded)
      return loaded
    } catch {
      return null
    }
  }

  async function openEdit(row: TimeEntryLedgerRow) {
    if (!(await ensureOptions())) return
    setEditing(row)
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Bulk attach: PATCH each selected entry's task_id. The resolver fills
  // project/engagement from the task; a 409 (cross-engagement contradiction, or
  // a billed row) lands as an inline error on that row, not an aborted batch.
  async function attachSelected(taskId: string) {
    setAttachBusy(true)
    setAttachOpen(false)
    const errors: Record<string, string> = {}
    for (const id of selected) {
      try {
        const res = await fetch(`/api/timesheet/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) errors[id] = json.error || `Failed (${res.status})`
      } catch {
        errors[id] = 'Request failed'
      }
    }
    setRowErrors(errors)
    setSelected(new Set(Object.keys(errors)))
    setAttachBusy(false)
    router.refresh()
  }

  function exportCsv() {
    const header = ['Date', 'Person', 'Engagement', 'Project', 'Task', 'Description', 'Minutes', 'Rate', 'Amount', 'Billable', 'Billed', 'Invoice']
    const lines = visibleRows.map((r) =>
      [
        r.entry_date,
        r.person?.full_name ?? '',
        r.engagement ? r.engagement.code ?? r.engagement.name : '',
        r.project?.name ?? '',
        r.task?.title ?? '',
        r.description ?? '',
        r.duration_minutes,
        r.rate_snapshot,
        r.billable ? ((r.duration_minutes / 60) * Number(r.rate_snapshot)).toFixed(2) : '0.00',
        r.billable ? 'yes' : 'no',
        r.billed ? 'yes' : 'no',
        r.invoice?.invoice_number ?? '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `time-${engagement?.code ?? scope.project_id ?? 'ledger'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const included = engagement?.included_hours_monthly ?? null
  const raiseHref = engagement
    ? `/invoicing/new?${engagement.end_client_account_id ? `account_id=${engagement.end_client_account_id}&` : ''}engagement_id=${engagement.id}`
    : null

  return (
    <div>
      {/* Header strip: this month against the allowance, previous month, all time, value, unbilled. */}
      <div className="stats-bar" style={{ borderTop: '1px solid var(--border)' }}>
        {hoursThisMonth ? (
          <div className="stat-item">
            <div className="stat-label">This billing month</div>
            <div className="stat-value" style={{ color: included != null && hoursThisMonth.used > included ? 'var(--red)' : 'var(--text)' }}>
              {hoursThisMonth.used.toFixed(1)}{included != null ? ` / ${included}h` : 'h'}
            </div>
            {included != null ? (
              <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 999, marginTop: 6 }}>
                <div style={{ width: `${Math.min(100, hoursThisMonth.pct)}%`, height: '100%', borderRadius: 999, background: hoursThisMonth.pct > 100 ? 'var(--red)' : hoursThisMonth.pct >= 80 ? 'var(--amber)' : 'var(--green)' }} />
              </div>
            ) : null}
          </div>
        ) : null}
        {prevBucket ? (
          <div className="stat-item">
            <div className="stat-label">Previous month</div>
            <div className="stat-value">{prevBucket.summary.total_hours.toFixed(1)}h</div>
            <div className="stat-sub">{formatBillingPeriod(prevBucket.period)}</div>
          </div>
        ) : null}
        <div className="stat-item"><div className="stat-label">All time</div><div className="stat-value">{allTime.total_hours.toFixed(1)}h</div><div className="stat-sub">{allTime.entry_count} entries</div></div>
        <div className="stat-item"><div className="stat-label">Billable value</div><div className="stat-value" style={{ color: 'var(--emerald)' }}>{formatCurrency(allTime.amount, 'GBP')}</div></div>
        {unattributed.count > 0 ? (
          <button className="stat-item" style={{ cursor: 'pointer', textAlign: 'left', border: 'none', borderRight: '1px solid var(--border)', background: unattributedOnly ? 'var(--amber-dim)' : undefined }} onClick={() => setUnattributedOnly((v) => !v)}>
            <div className="stat-label">Client exports</div>
            <div className="stat-value" style={{ color: 'var(--amber)', fontSize: 15 }}>
              {unattributed.count} {unattributed.count === 1 ? 'entry' : 'entries'} ({unattributed.hours.toFixed(1)}h)
            </div>
            <div className="stat-sub" style={{ textDecoration: 'underline' }}>would export unattributed. Review</div>
          </button>
        ) : null}
        <div className="stat-item">
          <div className="stat-label">Unbilled billable</div>
          <div className="stat-value" style={{ color: allTime.unbilled_amount > 0 ? 'var(--amber)' : 'var(--text-3)', fontWeight: 700 }}>
            {formatCurrency(allTime.unbilled_amount, 'GBP')}
          </div>
          {raiseHref && allTime.unbilled_amount > 0 ? (
            <div className="stat-sub"><Link href={raiseHref} style={{ textDecoration: 'underline' }}>Raise invoice</Link></div>
          ) : null}
        </div>
      </div>

      {noEngagementNote ? (
        <p style={{ padding: '8px 24px', margin: 0, background: 'var(--amber-dim)', borderBottom: '1px solid var(--amber)', color: 'var(--amber)', fontSize: 12 }}>
          {noEngagementNote}
        </p>
      ) : null}

      {/* Toolbar: log/timer locked to this scope, period chips, filters, export. */}
      <div className="filterbar" style={{ flexWrap: 'wrap' }}>
        <StartTimerButton engagementId={scope.engagement_id} projectId={scope.project_id} accountId={engagement?.end_client_account_id ?? undefined} />
        <LogTimeButton engagementId={scope.engagement_id} projectId={scope.project_id} onSaved={() => router.refresh()} />
        <div className="range-chips">
          <button className={`range-chip ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>All</button>
          {allBuckets.slice(0, 8).map((b) => (
            <button key={b.period.start} className={`range-chip ${period === b.period.start ? 'active' : ''}`} onClick={() => setPeriod(b.period.start)}>
              {formatBillingPeriod(b.period)}
            </button>
          ))}
        </div>
        {filterOptions.projects.length ? (
          <select className="filter-select" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {filterOptions.projects.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
          </select>
        ) : null}
        {filterOptions.people.length > 1 ? (
          <select className="filter-select" value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="">All people</option>
            {filterOptions.people.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
          </select>
        ) : null}
        {filterOptions.tasks.length ? (
          <select className="filter-select" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)}>
            <option value="">All tasks</option>
            {filterOptions.tasks.map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
          </select>
        ) : null}
        <select className="filter-select" value={billableFilter} onChange={(e) => setBillableFilter(e.target.value)}>
          <option value="">Billable + non</option>
          <option value="true">Billable</option>
          <option value="false">Non-billable</option>
        </select>
        <select className="filter-select" value={billedFilter} onChange={(e) => setBilledFilter(e.target.value)}>
          <option value="">Billed + unbilled</option>
          <option value="true">Billed</option>
          <option value="false">Unbilled</option>
        </select>
        <button
          className={`range-chip ${unattributedOnly ? 'active' : ''}`}
          onClick={() => setUnattributedOnly((v) => !v)}
          title="Rows that would print as (unattributed time) on client reports"
        >
          Unattributed only
        </button>
        {unattributedOnly && selected.size > 0 ? (
          <button className="btn btn-primary btn-sm" onClick={() => { setAttachOpen(true); void ensureOptions() }} disabled={attachBusy}>
            {attachBusy ? 'Attaching…' : `Attach ${selected.size} to task…`}
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} style={{ marginLeft: 'auto' }}>Export CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }} className="overflow-x-auto">
          {visibleRows.length === 0 ? (
            <div className="empty">No time logged{period !== 'all' ? ' in this billing month' : ' yet'}.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  {unattributedOnly ? <th style={{ width: 32 }}></th> : null}
                  <th>Date</th><th>Person</th><th>Project</th><th>Task</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th><th>Billable</th><th>Billed</th>
                </tr>
              </thead>
              {buckets.map((b) => (
                <tbody key={b.period.start}>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={unattributedOnly ? 6 : 5} style={{ fontWeight: 600, fontSize: 12 }}>
                      {formatBillingPeriod(b.period, { year: true })}{b.period.isFirst && engagement?.start_date ? ' · month one (incl. pre-start work)' : ''}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="td-mono">
                      {b.summary.total_hours.toFixed(1)}{included != null ? ` / ${included}h` : 'h'}
                    </td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="td-mono">{formatCurrency(b.summary.amount, 'GBP')}</td>
                    <td colSpan={2}></td>
                  </tr>
                  {b.rows.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => void openEdit(r)}>
                      {unattributedOnly ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelected(r.id)} aria-label="Select entry" />
                        </td>
                      ) : null}
                      <td className="td-mono">{fmtDate(r.entry_date)}</td>
                      <td>{r.person?.full_name ?? '—'}</td>
                      <td>{r.project?.name ?? '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task?.title ?? '—'}</td>
                      <td style={{ maxWidth: 260 }}>
                        <span style={{ display: 'inline-block', maxWidth: rowAttributed(r) ? 260 : 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{r.description ?? '—'}</span>
                        {!rowAttributed(r) ? (
                          <span className="pill" style={{ marginLeft: 6, background: 'var(--amber-dim)', color: 'var(--amber)' }} title="Would print as (unattributed time) on client reports. Add a client description or attach a task.">
                            Unattributed
                          </span>
                        ) : null}
                        {rowErrors[r.id] ? (
                          <span style={{ display: 'block', color: 'var(--red)', fontSize: 11 }}>{rowErrors[r.id]}</span>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{fmtDur(r.duration_minutes)}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{r.billable ? `£${Number(r.rate_snapshot).toFixed(0)}` : '—'}</td>
                      <td style={{ textAlign: 'right' }} className="td-mono">{r.billable ? formatCurrency((r.duration_minutes / 60) * Number(r.rate_snapshot), 'GBP') : '—'}</td>
                      <td><span className={`pill ${r.billable ? 'billable' : 'nonbill'}`}>{r.billable ? 'Billable' : 'Non-bill'}</span></td>
                      <td className="td-mono" style={{ fontSize: 11 }}>{r.billed ? r.invoice?.invoice_number ?? 'Billed' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          )}
        </div>

        {/* Side panel: where the selected period's time went. */}
        {visibleRows.length > 0 ? (
          <div style={{ flex: '0 1 260px', display: 'grid', gap: 14, padding: '12px 16px 12px 0' }}>
            {(
              [
                ['By project', selectedSummary.by_project],
                ['By person', selectedSummary.by_person],
                ['By task (top 10)', selectedSummary.by_task],
              ] as const
            ).map(([title, groups]) =>
              groups.length > 0 && !(groups.length === 1 && groups[0].id === null) ? (
                <div key={title}>
                  <div className="field-label" style={{ marginBottom: 6 }}>{title}</div>
                  {groups.slice(0, 10).map((g) => (
                    <div key={`${g.id}:${g.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                      <span className="td-mono" style={{ whiteSpace: 'nowrap' }}>{g.hours.toFixed(1)}h · {formatCurrency(g.amount, 'GBP')}</span>
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </div>
        ) : null}
      </div>

      {attachOpen && options ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4" onClick={() => setAttachOpen(false)}>
          <div className="panel" style={{ width: 420, maxHeight: '70vh', overflowY: 'auto', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-section-title" style={{ marginBottom: 8 }}>Attach {selected.size} {selected.size === 1 ? 'entry' : 'entries'} to task</div>
            {(scope.engagement_id ? options.tasks.filter((t) => t.engagement_id === scope.engagement_id) : options.tasks).map((t) => (
              <button
                key={t.id}
                className="btn btn-ghost btn-sm"
                style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }}
                onClick={() => void attachSelected(t.id)}
              >
                {t.title}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAttachOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {editing && options ? (
        <TimeEntryForm
          entry={editing}
          lock={{ engagement_id: scope.engagement_id, project_id: scope.project_id }}
          accounts={options.accounts}
          projects={options.projects}
          engagements={options.engagements}
          people={options.people}
          tasks={options.tasks}
          defaultPersonId={options.defaultPersonId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
          onDeleted={() => { setEditing(null); router.refresh() }}
        />
      ) : null}
    </div>
  )
}
