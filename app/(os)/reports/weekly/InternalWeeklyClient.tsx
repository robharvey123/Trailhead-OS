'use client'

import { useState } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/ui/PageHeader'
import type { InternalWeeklyReport } from '@/lib/reports/data'

function fmtRange(startIso: string, endIso: string): string {
  const f = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const year = new Date(`${endIso}T00:00:00`).getFullYear()
  return `${f(startIso)} – ${f(endIso)} ${year}`
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function hrs(n: number): string {
  return `${n.toFixed(1)}h`
}

export default function InternalWeeklyClient({
  data,
  maxBack,
}: {
  data: InternalWeeklyReport
  maxBack: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isCurrent = data.offsetWeeks === 0
  const atOldest = data.offsetWeeks <= -maxBack

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Weekly report"
        description={`${fmtRange(data.weekStart, data.weekEnd)} · time by engagement`}
        actions={
          <>
            <Link
              href={atOldest ? '#' : `/reports/weekly?week=${data.offsetWeeks - 1}`}
              aria-disabled={atOldest}
              className={`btn btn-ghost btn-sm ${atOldest ? 'pointer-events-none' : ''}`}
            >
              ‹ Earlier
            </Link>
            {!isCurrent ? (
              <Link
                href="/reports/weekly"
                className="btn btn-ghost btn-sm"
              >
                This week
              </Link>
            ) : null}
            <Link
              href={isCurrent ? '#' : `/reports/weekly?week=${data.offsetWeeks + 1}`}
              aria-disabled={isCurrent}
              className={`btn btn-ghost btn-sm ${isCurrent ? 'pointer-events-none' : ''}`}
            >
              Later ›
            </Link>
          </>
        }
      />

      <div className="os-card grid gap-4 p-5 sm:grid-cols-3">
        <Stat label="Total hours" value={hrs(data.totalHours)} />
        <Stat label="Billable value" value={money(data.totalValue, 'GBP')} />
        <Stat label="Engagements" value={String(data.engagements.length)} />
      </div>

      {data.engagements.length === 0 ? (
        <div className="rounded-card border border-dashed border-[color:var(--border)] px-4 py-10 text-center text-sm text-[color:var(--text-3)]">
          No time logged against an engagement this week.
        </div>
      ) : (
        <div className="os-card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="os-label border-b border-[color:var(--border)] text-left">
                <th className="px-4 py-3">Engagement</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Billable</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {data.engagements.map((e) => {
                const open = expanded.has(e.engagement_id)
                return (
                  <FragmentRow
                    key={e.engagement_id}
                    open={open}
                    onToggle={() => toggle(e.engagement_id)}
                    eng={e}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[color:var(--text-3)]">
        Client-facing reports (branded PDF + timesheet) generate from each engagement’s Reports tab.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="os-label">{label}</p>
      <p className="stat-value mt-1">{value}</p>
    </div>
  )
}

function FragmentRow({
  eng,
  open,
  onToggle,
}: {
  eng: import('@/lib/reports/data').InternalWeeklyEngagementRow
  open: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr className="border-b border-[color:var(--border)] transition hover:bg-[var(--surface-2)]">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left">
            <span className={`text-[color:var(--text-3)] transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
            <span className="font-medium text-[color:var(--text)]">{eng.engagement_name}</span>
            {!eng.is_billable ? (
              <span className="rounded-pill border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--text-3)]">internal</span>
            ) : null}
          </button>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-[color:var(--text)]">{hrs(eng.hours)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-[color:var(--text-2)]">{hrs(eng.billable_hours)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-[color:var(--text-2)]">
          {eng.is_billable ? money(eng.value, eng.currency) : '—'}
        </td>
        <td className="px-4 py-3 text-right">
          <Link href={`/engagements/${eng.engagement_id}`} className="text-xs text-[color:var(--accent-strong)] hover:underline">
            Open →
          </Link>
        </td>
      </tr>
      {open
        ? eng.projects.map((p) => (
            <tr key={p.project_id ?? '∅'} className="border-b border-[color:var(--border)] bg-[var(--surface-2)] text-[color:var(--text-2)]">
              <td className="px-4 py-2 pl-12">{p.project_name}</td>
              <td className="px-4 py-2 text-right tabular-nums">{hrs(p.hours)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{hrs(p.billable_hours)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{eng.is_billable ? money(p.value, eng.currency) : '—'}</td>
              <td></td>
            </tr>
          ))
        : null}
    </>
  )
}
