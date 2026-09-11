'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import { resolveTimeEntryDescription, UNATTRIBUTED_LABEL } from '@/lib/engagements/client-safe'
import type { TimeEntry } from '@/lib/types'

export type EngagementOption = {
  id: string
  name: string
  included_hours_monthly: number | null
  account_id: string | null
  hours_used_mtd: number
  is_billable: boolean
}
type Named = { id: string; name: string }
type ProjectOpt = Named & { account_id: string | null; engagement_id?: string | null }
type TaskOpt = { id: string; title: string; engagement_id: string | null; project_id?: string | null; client_description?: string | null }

/** The option lists this form renders — served ready-made by GET /api/timesheet/options. */
export type TimeEntryFormOptions = {
  accounts: Named[]
  projects: ProjectOpt[]
  engagements: EngagementOption[]
  people: Named[]
  tasks: TaskOpt[]
  defaultPersonId: string | null
}

interface Props {
  entry: TimeEntry | null
  accounts: Named[]
  projects: ProjectOpt[]
  engagements: EngagementOption[]
  people: Named[]
  tasks?: TaskOpt[]
  defaultPersonId?: string | null
  /** Locked links render as read-only chips, not selects. */
  lock?: { engagement_id?: string; project_id?: string; task_id?: string }
  /** 'assign' re-files a running entry's links (PATCH, no date/duration). */
  mode?: 'entry' | 'assign'
  onClose: () => void
  onSaved: (entry: TimeEntry) => void
  onDeleted: (id: string) => void
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const RATE_SOURCE_LABELS: Record<string, string> = {
  explicit: 'set on this entry',
  contributor: 'contributor rate',
  project: 'project rate',
  account: 'account default',
  none: 'no rate configured',
}

export default function TimeEntryForm({
  entry, accounts, projects, engagements, people, tasks = [], defaultPersonId, lock = {}, mode = 'entry', onClose, onSaved, onDeleted,
}: Props) {
  const assign = mode === 'assign'
  const editing = !!entry && !assign
  const [date, setDate] = useState(entry?.entry_date ?? new Date().toISOString().split('T')[0])
  const [personId, setPersonId] = useState(entry?.person_id ?? defaultPersonId ?? '')
  const [accountId, setAccountId] = useState(entry?.account_id ?? '')
  const [engagementId, setEngagementId] = useState(entry?.engagement_id ?? lock.engagement_id ?? '')
  const [projectId, setProjectId] = useState(entry?.project_id ?? lock.project_id ?? '')
  const [taskId, setTaskId] = useState(entry?.task_id ?? lock.task_id ?? '')
  const [hours, setHours] = useState(entry ? String(Math.floor(entry.duration_minutes / 60)) : '0')
  const [minutes, setMinutes] = useState(entry ? String(entry.duration_minutes % 60) : '0')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [clientDescription, setClientDescription] = useState(entry?.client_description ?? '')
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [rateOverride, setRateOverride] = useState(editing && entry ? String(entry.rate_snapshot) : '')
  const [preview, setPreview] = useState<{ rate_snapshot: number; rate_source: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // On open with a locked task/project, cascade immediately so the chips agree.
  const cascadedOnce = useRef(false)
  useEffect(() => {
    if (cascadedOnce.current) return
    cascadedOnce.current = true
    if (lock.task_id) {
      const t = tasks.find((x) => x.id === lock.task_id)
      if (t) {
        if (t.engagement_id) setEngagementId((cur) => cur || t.engagement_id!)
        if (t.project_id) setProjectId((cur) => cur || t.project_id!)
      }
    } else if (lock.project_id) {
      const p = projects.find((x) => x.id === lock.project_id)
      if (p?.engagement_id) setEngagementId((cur) => cur || p.engagement_id!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const eng = engagements.find((e) => e.id === engagementId)
  const visibleProjects = useMemo(() => {
    if (engagementId) return projects.filter((p) => p.engagement_id === engagementId)
    if (accountId) return projects.filter((p) => p.account_id === accountId)
    return projects
  }, [projects, engagementId, accountId])
  const visibleTasks = useMemo(() => {
    let list = engagementId ? tasks.filter((t) => t.engagement_id === engagementId) : tasks
    if (projectId) list = list.filter((t) => (t.project_id ?? null) === projectId || t.project_id === undefined)
    return list
  }, [tasks, engagementId, projectId])
  // If the form was opened from an engagement page, its contributors sort first
  // server-side; here we just render what we're given.

  // Debounced rate preview mirroring the server resolver, so the rate the entry
  // WILL get is visible before saving. An override field pins it.
  useEffect(() => {
    if (!engagementId && !projectId && !accountId) { setPreview(null); return }
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (engagementId) params.set('engagement_id', engagementId)
        if (projectId) params.set('project_id', projectId)
        if (taskId) params.set('task_id', taskId)
        if (accountId) params.set('account_id', accountId)
        if (personId) params.set('person_id', personId)
        const res = await fetch(`/api/timesheet/rate-preview?${params}`)
        if (res.ok) setPreview(await res.json())
      } catch { /* preview only */ }
    }, 300)
    return () => clearTimeout(handle)
  }, [engagementId, projectId, taskId, accountId, personId])

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'
  const chip = 'inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-sm text-[var(--text)]'

  // Cascading defaults mirror the resolver: task → engagement + project;
  // project → engagement (+ account); engagement → account + billable, and a
  // project that doesn't belong to the new engagement is cleared.
  function onPickTask(id: string) {
    setTaskId(id)
    const t = tasks.find((x) => x.id === id)
    if (t) {
      if (t.engagement_id) onPickEngagement(t.engagement_id, { keepTask: true })
      if (t.project_id) setProjectId(t.project_id)
    }
  }
  function onPickProject(id: string) {
    setProjectId(id)
    const p = projects.find((x) => x.id === id)
    if (p) {
      if (p.engagement_id && p.engagement_id !== engagementId) onPickEngagement(p.engagement_id, { keepProject: true, keepTask: true })
      if (p.account_id) setAccountId(p.account_id)
    }
  }
  function onPickEngagement(id: string, opts: { keepProject?: boolean; keepTask?: boolean } = {}) {
    setEngagementId(id)
    if (!opts.keepTask) setTaskId('')
    const e = engagements.find((x) => x.id === id)
    if (e) {
      if (e.account_id) setAccountId(e.account_id)
      setBillable(e.is_billable)
    }
    if (!opts.keepProject) {
      const current = projects.find((x) => x.id === projectId)
      if (current && current.engagement_id && current.engagement_id !== id) setProjectId('')
    }
  }

  async function save() {
    setBusy(true); setError('')
    try {
      if (assign && entry) {
        const result = await apiFetch<{ entry: TimeEntry }>(`/api/timesheet/${entry.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engagement_id: engagementId || null,
            project_id: projectId || null,
            task_id: taskId || null,
            account_id: accountId || null,
            description: description || null,
          }),
        })
        onSaved(result.entry); onClose(); return
      }
      const duration = (Number(hours) || 0) * 60 + (Number(minutes) || 0)
      if (duration <= 0) { setError('Duration must be greater than zero.'); setBusy(false); return }
      const payload: Record<string, unknown> = {
        person_id: personId || null,
        account_id: accountId || null,
        project_id: projectId || null,
        engagement_id: engagementId || null,
        task_id: taskId || null,
        entry_date: date,
        duration_minutes: duration,
        description: description || null,
        client_description: clientDescription || null,
        billable,
      }
      if (rateOverride.trim() !== '') payload.rate_snapshot = Number(rateOverride)
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

  // What the client artefacts would print for this entry, resolved with the
  // same pure chain the exports use (entry line, then the task's).
  const selectedTask = tasks.find((t) => t.id === taskId) ?? null
  const clientPreview = resolveTimeEntryDescription({
    entry_client_description: clientDescription,
    task_client_description: selectedTask?.client_description ?? null,
    task_title: selectedTask?.title ?? null,
  })

  const lockedEngagement = lock.engagement_id ? engagements.find((e) => e.id === lock.engagement_id) : null
  const lockedProject = lock.project_id ? projects.find((p) => p.id === lock.project_id) : null
  const lockedTask = lock.task_id ? tasks.find((t) => t.id === lock.task_id) : null
  const billed = Boolean(entry?.billed)
  const rateShown = rateOverride.trim() !== '' ? Number(rateOverride) : preview?.rate_snapshot ?? entry?.rate_snapshot ?? 0
  const rateSourceLabel = rateOverride.trim() !== '' ? RATE_SOURCE_LABELS.explicit : RATE_SOURCE_LABELS[preview?.rate_source ?? ''] ?? null

  const deleteLabel = entry
    ? `${fmtDur(entry.duration_minutes)} on ${accounts.find((a) => a.id === entry.account_id)?.name ?? 'no account'}${eng ? ` — ${eng.name}` : ''}`
    : ''

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(15,23,42,0.45)]" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-base font-semibold text-[var(--text)]">
            {assign ? 'Assign running timer' : editing ? 'Edit entry' : 'Add time entry'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)]" type="button">✕</button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {billed ? (
            <p className="rounded-[5px] border border-[var(--amber)] bg-[var(--amber-dim)] px-3 py-2 text-xs text-[var(--amber-strong)]">
              This entry is billed{entry?.invoice_id ? ' on an invoice' : ''} — only the description can change.
            </p>
          ) : null}

          {!assign ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Date</label><input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} disabled={billed} /></div>
              <div>
                <label className={label}>Duration</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} className={input} value={hours} onChange={(e) => setHours(e.target.value)} disabled={billed} /><span className="text-xs text-[var(--text-3)]">h</span>
                  <input type="number" min={0} max={59} className={input} value={minutes} onChange={(e) => setMinutes(e.target.value)} disabled={billed} /><span className="text-xs text-[var(--text-3)]">m</span>
                </div>
              </div>
            </div>
          ) : null}

          {!assign ? (
            <div><label className={label}>Person</label>
              <select className={input} value={personId} onChange={(e) => setPersonId(e.target.value)} disabled={billed}>
                <option value="">— unattributed</option>
                {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          ) : null}

          <div><label className={label}>Engagement</label>
            {lockedEngagement ? (
              <span className={chip}>{lockedEngagement.name}</span>
            ) : (
              <select className={input} value={engagementId} onChange={(e) => onPickEngagement(e.target.value)} disabled={billed}>
                <option value="">— none</option>
                {engagements.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
              </select>
            )}
          </div>
          <div><label className={label}>Project</label>
            {lockedProject ? (
              <span className={chip}>{lockedProject.name}</span>
            ) : (
              <select className={input} value={projectId} onChange={(e) => onPickProject(e.target.value)} disabled={billed}>
                <option value="">—</option>
                {visibleProjects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            )}
          </div>
          <div><label className={label}>Task</label>
            {lockedTask ? (
              <span className={chip}>{lockedTask.title}</span>
            ) : visibleTasks.length ? (
              <select className={input} value={taskId} onChange={(e) => onPickTask(e.target.value)} disabled={billed}>
                <option value="">— none</option>
                {visibleTasks.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
              </select>
            ) : (
              <span className="text-xs text-[var(--text-3)]">No open tasks{engagementId ? ' on this engagement' : ''}.</span>
            )}
          </div>
          <div><label className={label}>Account</label>
            <select className={input} value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={billed}>
              <option value="">— derived from the links above</option>
              {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          </div>

          <div><label className={label}>Description</label><textarea className={`${input} min-h-[5rem] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} /></div>

          {!assign ? (
            <div>
              <label className={label}>Client description</label>
              <textarea rows={2} className={`${input} resize-y`} value={clientDescription} onChange={(e) => setClientDescription(e.target.value)} />
              <p className="mt-1 text-[11px] text-[var(--text-3)]">
                Shown on client reports. Leave blank to use the linked task&apos;s client description or title. Internal description above is never shown to clients.
              </p>
              {clientPreview ? (
                <p className="mt-1 text-[11px] text-[var(--text-2)]">
                  Exports as: <span className="font-medium text-[var(--text)]">{clientPreview}</span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] font-medium text-[var(--amber)]">
                  Would export as &quot;{UNATTRIBUTED_LABEL}&quot;
                </p>
              )}
            </div>
          ) : null}

          {!assign ? (
            <>
              <label className="flex items-center gap-2 text-sm text-[var(--text-2)]"><input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} disabled={billed} /> Billable</label>
              <div>
                <p className="text-xs text-[var(--text-3)]">
                  Rate: <span className="font-medium text-[var(--text)]">£{Number(rateShown).toFixed(2)}/h</span>
                  {rateSourceLabel ? ` (${rateSourceLabel})` : ''}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number" min={0} step="0.01" placeholder="Override £/h — blank = derived"
                    className={input} value={rateOverride} onChange={(e) => setRateOverride(e.target.value)} disabled={billed}
                  />
                </div>
              </div>
            </>
          ) : null}

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
          {editing && !billed ? <button className="text-sm text-[var(--red)] hover:opacity-80" onClick={() => setConfirmDelete(true)}>Delete</button> : <span />}
          <div className="flex gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : assign ? 'Re-file timer' : 'Save entry'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
