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
    <li style={{ display: 'grid', gap: 2, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <span className="td-mono" style={{ color: 'var(--text-3)', minWidth: 84 }}>{fmtDate(entry.entry_date)}</span>
        <span style={{ color: 'var(--text)', flex: 1 }}>{entry.person?.full_name ?? 'Unattributed'}</span>
        <span className="td-mono" style={{ color: 'var(--text)' }}>{hrs(entry.duration_minutes)}</span>
        {entry.billable ? <span className="channel-tag" style={{ background: 'var(--emerald-dim)', color: 'var(--emerald-strong)' }}>Billable</span> : null}
      </div>
      {note ? (
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
          <span style={expanded ? undefined : { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note}</span>
          {note.length > 60 ? (
            <button onClick={() => setExpanded((v) => !v)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 11 }}>
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

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Summary line (aggregate — everyone's time, via SECURITY DEFINER fn). */}
      {total > 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          <strong>Total: {hrs(total)}</strong> logged across {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
          {billableMin > 0 && internalMin > 0 ? (
            <span style={{ color: 'var(--text-3)' }}> · {hrs(billableMin)} billable, {hrs(internalMin)} internal</span>
          ) : null}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>No time logged yet.</p>
      )}

      {/* Per-person chips. */}
      {summary.people.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
          {summary.people.map((p, i) => (
            <span key={p.personId ?? `none-${i}`}>
              {p.fullName} <span className="td-mono" style={{ color: 'var(--text-3)' }}>{hrs(p.minutes)}</span>
              {i < summary.people.length - 1 ? <span style={{ color: 'var(--text-3)' }}> · </span> : null}
            </span>
          ))}
        </div>
      ) : null}

      {/* Itemised list — RLS-scoped to the viewer's own entries. */}
      {entries.length ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 240, overflowY: 'auto' }}>
          {entries.map((e) => <EntryRow key={e.id} entry={e} />)}
        </ul>
      ) : null}
      {hiddenMinutes > 0 ? (
        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
          You see your own entries here; the total above includes {hrs(hiddenMinutes)} logged by others.
        </p>
      ) : null}

      {canLog ? (
        <div>
          <button className="btn btn-primary btn-sm" onClick={openModal}>Log time</button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(15,23,42,0.45)' }} onClick={() => !busy && setOpen(false)}>
          <div className="panel" style={{ width: 'min(420px, 92vw)', padding: 20, display: 'grid', gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <div className="panel-section-title" style={{ margin: 0 }}>Log time</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable
            </label>
            {error ? <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p> : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
