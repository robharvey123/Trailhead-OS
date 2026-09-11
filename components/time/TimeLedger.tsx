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
  const [editing, setEditing] = useState<TimeEntryLedgerRow | null>(null)
  const [options, setOptions] = useState<TimeEntryFormOptions | null>(null)

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (projectFilter && r.project_id !== projectFilter) return false
        if (personFilter && r.person_id !== personFilter) return false
        if (taskFilter && r.task_id !== taskFilter) return false
        if (billableFilter && String(r.billable) !== billableFilter) return false
        if (billedFilter && String(Boolean(r.billed)) !== billedFilter) return false
        return true
      }),
    [rows, projectFilter, personFilter, taskFilter, billableFilter, billedFilter]
  )

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

  async function openEdit(row: TimeEntryLedgerRow) {
    if (!options) {
      try {
        const res = await fetch('/api/timesheet/options')
        if (res.ok) setOptions((await res.json()) as TimeEntryFormOptions)
        else return
      } catch { return }
    }
    setEditing(row)
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
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} style={{ marginLeft: 'auto' }}>Export CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }} className="overflow-x-auto">
          {visibleRows.length === 0 ? (
            <div className="empty">No time logged{period !== 'all' ? ' in this billing month' : ' yet'}.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Person</th><th>Project</th><th>Task</th><th>Description</th><th style={{ textAlign: 'right' }}>Duration</th><th style={{ textAlign: 'right' }}>Rate</th><th style={{ textAlign: 'right' }}>Amount</th><th>Billable</th><th>Billed</th></tr>
              </thead>
              {buckets.map((b) => (
                <tbody key={b.period.start}>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={5} style={{ fontWeight: 600, fontSize: 12 }}>
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
                      <td className="td-mono">{fmtDate(r.entry_date)}</td>
                      <td>{r.person?.full_name ?? '—'}</td>
                      <td>{r.project?.name ?? '—'}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.task?.title ?? '—'}</td>
                      <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description ?? '—'}</td>
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
