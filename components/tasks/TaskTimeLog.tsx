'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logTaskTime } from '@/app/(os)/my-work/actions'
import type { TaskTimeSummary, TaskTimeEntryRow } from '@/lib/db/timesheet'

function hrs(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`
}
function fmtDate(v: string): string {
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** One itemised row; notes truncate to a line with a more/less toggle. */
function EntryRow({ entry }: { entry: TaskTimeEntryRow }) {
  const [expanded, setExpanded] = useState(false)
  const note = entry.description?.trim() || ''
  return (
    <li className="grid gap-0.5 border-b border-[var(--border)] py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="td-num min-w-[84px]">{fmtDate(entry.entry_date)}</span>
        <span className="flex-1 text-[var(--text)]">{entry.person?.full_name ?? 'Unattributed'}</span>
        <span className="td-num text-[var(--text)]!">{hrs(entry.duration_minutes)}</span>
        {entry.billable ? <span className="pill billable">Billable</span> : null}
      </div>
      {note ? (
        <div className="text-xs text-[var(--text-2)]">
          <span className={expanded ? undefined : 'block truncate'}>{note}</span>
          {note.length > 60 ? (
            <button onClick={() => setExpanded((v) => !v)} className="cursor-pointer border-0 bg-transparent p-0 text-[11px] text-[var(--accent-strong)]">
              {expanded ? 'less' : 'more'}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export default function TaskTimeLog({
  taskId,
  defaultBillable,
  canLog,
  summary,
  entries,
}: {
  taskId: string
  defaultBillable: boolean
  canLog: boolean
  summary: TaskTimeSummary
  entries: TaskTimeEntryRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hoursInput, setHoursInput] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [billable, setBillable] = useState(defaultBillable)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const total = summary.totalMinutes
  const billableMin = summary.billableMinutes
  const internalMin = total - billableMin
  const peopleCount = summary.people.length
  const visibleMinutes = entries.reduce((s, e) => s + e.duration_minutes, 0)
  const hiddenMinutes = Math.max(0, total - visibleMinutes)

  function openModal() {
    setHoursInput(''); setDate(todayISO()); setNotes(''); setBillable(defaultBillable); setError(''); setOpen(true)
  }

  async function submit() {
    const h = Number(hoursInput)
    if (!h || h <= 0) { setError('Enter hours greater than zero.'); return }
    setBusy(true); setError('')
    const res = await logTaskTime(taskId, { hours: h, date, description: notes, billable })
    if (res.error) { setError(res.error); setBusy(false); return }
    setBusy(false); setOpen(false); router.refresh()
  }

  const input = 'w-full rounded-control border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="grid gap-3">
      {/* Summary line (aggregate — everyone's time, via SECURITY DEFINER fn). */}
      {total > 0 ? (
        <div className="text-[13px] text-[var(--text)]">
          <strong>Total: {hrs(total)}</strong> logged across {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
          {billableMin > 0 && internalMin > 0 ? (
            <span className="text-[var(--text-3)]"> · {hrs(billableMin)} billable, {hrs(internalMin)} internal</span>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-[var(--text-3)]">No time logged yet.</p>
      )}

      {/* Per-person chips. */}
      {summary.people.length ? (
        <div className="flex flex-wrap gap-1.5 text-xs text-[var(--text-2)]">
          {summary.people.map((p, i) => (
            <span key={p.personId ?? `none-${i}`}>
              {p.fullName} <span className="td-num">{hrs(p.minutes)}</span>
              {i < summary.people.length - 1 ? <span className="text-[var(--text-3)]"> · </span> : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* Itemised list — RLS-scoped to the viewer's own entries. */}
      {entries.length ? (
        <ul className="m-0 max-h-60 list-none overflow-y-auto p-0">
          {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
        </ul>
      ) : null}
      {hiddenMinutes > 0 ? (
        <p className="m-0 text-[11px] text-[var(--text-3)]">
          You see your own entries here; the total above includes {hrs(hiddenMinutes)} logged by others.
        </p>
      ) : null}

      {canLog ? (
        <div>
          <button className="btn btn-primary btn-sm" onClick={openModal}>Log time</button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy)]/45" onClick={() => !busy && setOpen(false)}>
          <div className="panel grid w-[min(420px,92vw)] gap-3 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="panel-section-title m-0!">Log time</div>
            <div className="grid grid-cols-[1fr_1fr] gap-2.5">
              <div>
                <label className="field-label">Hours</label>
                <input className={input} type="number" min={0} step={0.25} value={hoursInput} placeholder="e.g. 1.5" onChange={(e) => setHoursInput(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="field-label">Date</label>
                <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Notes</label>
              <textarea className={`${input} min-h-[4rem] resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you work on?" />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-2)]">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable
            </label>
            {error ? <p className="m-0 text-xs text-[var(--red)]">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
