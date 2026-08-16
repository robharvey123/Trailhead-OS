'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTask } from '@/app/(os)/my-work/actions'
import { convertMessageToTask } from '@/app/(os)/messages/actions'
import LabelPicker from '@/components/tasks/LabelPicker'
import Modal from '@/components/ui/Modal'
import { ENGAGEMENT_TASK_PRIORITIES, ENGAGEMENT_TASK_PRIORITY_LABELS, type EngagementTask, type EngagementTaskPriority } from '@/lib/types'

type Named = { id: string; name: string }

export default function TaskForm({
  people,
  engagements,
  availableLabels = [],
  fixedEngagementId,
  fixedProjectId,
  initialTitle,
  initialDescription,
  initialAssigneeId,
  initialEngagementId,
  sourceMessageId,
  onConverted,
  onCreated,
  onClose,
}: {
  people: Named[]
  engagements: Named[]
  /** Labels already present in the project, offered in the label picker. */
  availableLabels?: string[]
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
  /** Fires after a normal task create with the new row, so the caller can reveal it. */
  onCreated?: (task: EngagementTask) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [description, setDescription] = useState(initialDescription ?? '')
  const [priority, setPriority] = useState<EngagementTaskPriority>('normal')
  const [assignee, setAssignee] = useState(initialAssigneeId ?? '')
  const [engagementId, setEngagementId] = useState(fixedEngagementId ?? initialEngagementId ?? '')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const errorId = useId()

  const heading = sourceMessageId ? 'New task from message' : 'New task'
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
      labels,
    })
    if (res.error) { setError(res.error); setBusy(false); return }
    if (res.task) onCreated?.(res.task)
    onClose()
    router.refresh()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={heading}
      closeLabel="Close new task dialog"
      overlayClassName="overflow-y-auto p-4"
      panelClassName="panel max-h-[85vh] w-full max-w-[480px] overflow-y-auto p-5"
    >
      <div className="panel-section-title">{heading}</div>
      <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
        <label className="block">
          <span className={label}>Title *</span>
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </label>
        <label className="block"><span className={label}>Description</span><textarea className={`${input} min-h-[4rem] resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="block"><span className={label}>Priority</span>
            <select className={input} value={priority} onChange={(e) => setPriority(e.target.value as EngagementTaskPriority)}>
              {ENGAGEMENT_TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{ENGAGEMENT_TASK_PRIORITY_LABELS[p]}</option>))}
            </select>
          </label>
          <label className="block"><span className={label}>Assignee</span>
            <select className={input} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">— unassigned</option>
              {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="block"><span className={label}>Due date</span><input type="date" className={input} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          {!fixedEngagementId ? (
            <label className="block"><span className={label}>Engagement</span>
              <select className={input} value={engagementId} onChange={(e) => setEngagementId(e.target.value)}>
                <option value="">— none</option>
                {engagements.map((en) => (<option key={en.id} value={en.id}>{en.name}</option>))}
              </select>
            </label>
          ) : null}
        </div>
        {/* LabelPicker renders its own filter input and chips, so the group heading
            is a span — a <label> here would have no single control to point at. */}
        <div><span className={label}>Labels</span><LabelPicker available={availableLabels} selected={labels} onChange={setLabels} /></div>
        {error ? <p id={errorId} role="alert" style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create task'}</button>
        </div>
      </div>
    </Modal>
  )
}
