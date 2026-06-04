'use client'

import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { TimeEntry } from '@/lib/types'

export type EngagementOption = {
  id: string
  name: string
  workstreams: string[]
  included_hours_monthly: number | null
  account_id: string | null
  hours_used_mtd: number
  is_billable: boolean
}
type Named = { id: string; name: string }
type TaskOpt = { id: string; title: string; engagement_id: string | null }

interface Props {
  entry: TimeEntry | null
  accounts: Named[]
  projects: Array<Named & { account_id: string | null }>
  engagements: EngagementOption[]
  people: Named[]
  /** Open engagement tasks, for the optional task picker (filtered by engagement). */
  tasks?: TaskOpt[]
  /** Who to attribute new entries to by default (the logged-in owner's person row). */
  defaultPersonId?: string | null
  onClose: () => void
  onSaved: (entry: TimeEntry) => void
  onDeleted: (id: string) => void
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TimeEntryForm({ entry, accounts, projects, engagements, people, tasks = [], defaultPersonId, onClose, onSaved, onDeleted }: Props) {
  const editing = !!entry
  const [date, setDate] = useState(entry?.entry_date ?? new Date().toISOString().split('T')[0])
  const [personId, setPersonId] = useState(entry?.person_id ?? defaultPersonId ?? '')
  const [accountId, setAccountId] = useState(entry?.account_id ?? '')
  const [engagementId, setEngagementId] = useState(entry?.engagement_id ?? '')
  const [workstream, setWorkstream] = useState(entry?.workstream ?? '')
  const [projectId, setProjectId] = useState(entry?.project_id ?? '')
  const [taskId, setTaskId] = useState(entry?.task_id ?? '')
  const [hours, setHours] = useState(entry ? String(Math.floor(entry.duration_minutes / 60)) : '0')
  const [minutes, setMinutes] = useState(entry ? String(entry.duration_minutes % 60) : '0')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const eng = engagements.find((e) => e.id === engagementId)
  const visibleProjects = useMemo(
    () => (accountId ? projects.filter((p) => p.account_id === accountId) : projects),
    [projects, accountId]
  )
  // Task picker only makes sense once an engagement is chosen; scope to its tasks.
  const visibleTasks = useMemo(
    () => (engagementId ? tasks.filter((t) => t.engagement_id === engagementId) : []),
    [tasks, engagementId]
  )

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'

  function onPickEngagement(id: string) {
    setEngagementId(id)
    setTaskId('') // a task belongs to one engagement; clear when the engagement changes
    const e = engagements.find((x) => x.id === id)
    if (e) {
      if (e.account_id && !accountId) setAccountId(e.account_id)
      if (!workstream && e.workstreams[0]) setWorkstream(e.workstreams[0])
      // Default billable from the engagement type (internal = non-billable); still overridable below.
      setBillable(e.is_billable)
    } else {
      setWorkstream('')
    }
  }

  async function save() {
    const duration = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
    if (duration <= 0) { setError('Duration must be greater than zero.'); return }
    if (engagementId && !workstream) { setError('Pick a workstream for this engagement.'); return }
    setBusy(true); setError('')
    const payload = {
      person_id: personId || null,
      account_id: accountId || null,
      project_id: projectId || null,
      engagement_id: engagementId || null,
      task_id: taskId || null,
      workstream: workstream || null,
      entry_date: date,
      duration_minutes: duration,
      description: description || null,
      billable,
    }
    try {
      const result = editing
        ? await apiFetch<{ entry: TimeEntry }>(`/api/timesheet/${entry!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await apiFetch<{ entry: TimeEntry }>('/api/timesheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      onSaved(result.entry)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
      setBusy(false)
    }
  }

  async function doDelete() {
    if (!entry) return
    setBusy(true); setError('')
    try {
      await apiFetch(`/api/timesheet/${entry.id}`, { method: 'DELETE' })
      onDeleted(entry.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry')
      setBusy(false)
    }
  }

  const deleteLabel = entry
    ? `${fmtDur(entry.duration_minutes)} on ${accounts.find((a) => a.id === entry.account_id)?.name ?? 'no account'}${eng ? ` — ${eng.name}` : ''}`
    : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.45)]" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">{editing ? 'Edit entry' : 'Add time entry'}</h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)]" type="button">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Date</label><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <label className={label}>Duration</label>
              <div className="flex items-center gap-1">
                <input type="number" min={0} className={input} value={hours} onChange={(e) => setHours(e.target.value)} /><span className="text-xs text-[var(--text-3)]">h</span>
                <input type="number" min={0} max={59} className={input} value={minutes} onChange={(e) => setMinutes(e.target.value)} /><span className="text-xs text-[var(--text-3)]">m</span>
              </div>
            </div>
          </div>
          <div><label className={label}>Person</label>
            <select className={input} value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">— unattributed</option>
              {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div><label className={label}>Account</label>
            <select className={input} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>
          <div><label className={label}>Engagement</label>
            <select className={input} value={engagementId} onChange={(e) => onPickEngagement(e.target.value)}>
              <option value="">— none</option>
              {engagements.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
            </select>
          </div>
          {eng ? (
            <div><label className={label}>Workstream *</label>
              <select className={input} value={workstream} onChange={(e) => setWorkstream(e.target.value)}>
                <option value="">— pick</option>
                {eng.workstreams.map((w) => (<option key={w} value={w}>{w}</option>))}
              </select>
            </div>
          ) : null}
          <div><label className={label}>Project</label>
            <select className={input} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {visibleProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          {engagementId && visibleTasks.length ? (
            <div><label className={label}>Task</label>
              <select className={input} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">— none</option>
                {visibleTasks.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
              </select>
            </div>
          ) : null}
          <div><label className={label}>Description</label><textarea className={`${input} min-h-[5rem] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-2)]"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} /> Billable</label>
          {error ? <p className="text-sm text-[var(--red)]">{error}</p> : null}

          {confirmDelete ? (
            <div className="rounded-[5px] border border-[var(--red)] bg-[var(--red-dim)] p-3">
              <p className="text-sm text-[var(--text)]">Delete this entry? {deleteLabel}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn btn-sm" style={{ background: 'var(--red)', color: 'white' }} onClick={doDelete} disabled={busy}>Delete entry</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4">
          {editing ? <button className="text-sm text-[var(--red)] hover:opacity-80" onClick={() => setConfirmDelete(true)}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save entry'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
