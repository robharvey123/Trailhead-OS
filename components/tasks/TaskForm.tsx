'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTask } from '@/app/(os)/my-work/actions'
import { convertMessageToTask } from '@/app/(os)/messages/actions'
import { ENGAGEMENT_TASK_PRIORITIES, ENGAGEMENT_TASK_PRIORITY_LABELS, type EngagementTaskPriority } from '@/lib/types'

type Named = { id: string; name: string }

export default function TaskForm({
  people,
  engagements,
  fixedEngagementId,
  fixedProjectId,
  initialTitle,
  initialDescription,
  initialAssigneeId,
  initialEngagementId,
  sourceMessageId,
  onConverted,
  onClose,
}: {
  people: Named[]
  engagements: Named[]
  fixedEngagementId?: string
  /** When created from a project page: stamps project_id (and uses the project's engagement). */
  fixedProjectId?: string
  initialTitle?: string
  initialDescription?: string
  initialAssigneeId?: string
  /** Pre-selects an engagement but leaves the picker editable (channel default). */
  initialEngagementId?: string
  /** When set, the task is created via convertMessageToTask (stamps source_message_id). */
  sourceMessageId?: string
  onConverted?: (taskId: string, title: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [priority, setPriority] = useState<EngagementTaskPriority>('normal')
  const [assignee, setAssignee] = useState(initialAssigneeId ?? '')
  const [engagementId, setEngagementId] = useState(fixedEngagementId ?? initialEngagementId ?? '')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const input = 'w-full rounded-[5px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]'
  const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]'

  async function submit() {
    if (!title.trim()) { setError('Title is required.'); return }
    setBusy(true); setError('')

    if (sourceMessageId) {
      // Convert-from-message path: stamps source_message_id, reporter = me.
      const res = await convertMessageToTask({
        messageId: sourceMessageId,
        title,
        description,
        assigneePersonId: assignee || null,
        engagementId: (fixedEngagementId ?? engagementId) || null,
        projectId: fixedProjectId || null,
        priority,
      })
      if (res.error || !res.taskId) { setError(res.error ?? 'Could not create the task.'); setBusy(false); return }
      onConverted?.(res.taskId, res.title ?? title)
      onClose()
      return
    }

    const res = await createTask({
      title,
      description: description || null,
      engagementId: engagementId || null,
      projectId: fixedProjectId || null,
      assigneePersonId: assignee || null,
      priority,
      dueDate: dueDate || null,
      labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
    })
    if (res.error) { setError(res.error); setBusy(false); return }
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(15,23,42,0.45)', padding: '60px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="panel" style={{ width: '100%', maxWidth: 480, padding: 20 }}>
        <div className="panel-section-title">{sourceMessageId ? 'New task from message' : 'New task'}</div>
        <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
          <div><label className={label}>Title *</label><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><label className={label}>Description</label><textarea className={`${input} min-h-[4rem] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className={label}>Priority</label>
              <select className={input} value={priority} onChange={(e) => setPriority(e.target.value as EngagementTaskPriority)}>
                {ENGAGEMENT_TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{ENGAGEMENT_TASK_PRIORITY_LABELS[p]}</option>))}
              </select>
            </div>
            <div><label className={label}>Assignee</label>
              <select className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">— unassigned</option>
                {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label className={label}>Due date</label><input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            {!fixedEngagementId ? (
              <div><label className={label}>Engagement</label>
                <select className={input} value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
                  <option value="">— none</option>
                  {engagements.map((en) => (<option key={en.id} value={en.id}>{en.name}</option>))}
                </select>
              </div>
            ) : null}
          </div>
          <div><label className={label}>Labels (comma-separated)</label><input className={input} value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="bug, frontend" /></div>
          {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create task'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
