'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignTask, moveTask, updateTask } from '@/app/(os)/my-work/actions'
import {
  ENGAGEMENT_TASK_PRIORITIES,
  ENGAGEMENT_TASK_PRIORITY_LABELS,
  ENGAGEMENT_TASK_STATUSES,
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTaskPriority,
  type EngagementTaskStatus,
} from '@/lib/types'

type Named = { id: string; name: string }

export default function TaskDetailControls({
  taskId,
  status,
  position,
  assigneePersonId,
  priority,
  dueDate,
  labels,
  people,
}: {
  taskId: string
  status: EngagementTaskStatus
  position: number
  assigneePersonId: string | null
  priority: EngagementTaskPriority
  dueDate: string | null
  labels: string[]
  people: Named[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [labelText, setLabelText] = useState(labels.join(', '))

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) setError(res.error)
      else { setError(''); router.refresh() }
    })
  }

  const sel = 'filter-select'
  const labelCls: React.CSSProperties = { fontSize: 12, color: 'var(--text-3)' }
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <label style={labelCls}>Status</label>
      <select className={sel} value={status} disabled={pending} onChange={(e) => run(() => moveTask(taskId, e.target.value as EngagementTaskStatus, position))}>
        {ENGAGEMENT_TASK_STATUSES.map((s) => (<option key={s} value={s}>{ENGAGEMENT_TASK_STATUS_LABELS[s]}</option>))}
      </select>

      <label style={labelCls}>Assignee</label>
      <select className={sel} value={assigneePersonId ?? ''} disabled={pending} onChange={(e) => run(() => assignTask(taskId, e.target.value || null))}>
        <option value="">— unassigned</option>
        {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
      </select>

      <label style={labelCls}>Priority</label>
      <select className={sel} value={priority} disabled={pending} onChange={(e) => run(() => updateTask(taskId, { priority: e.target.value as EngagementTaskPriority }))}>
        {ENGAGEMENT_TASK_PRIORITIES.map((p) => (<option key={p} value={p}>{ENGAGEMENT_TASK_PRIORITY_LABELS[p]}</option>))}
      </select>

      <label style={labelCls}>Due</label>
      <input type="date" className={sel} value={dueDate ?? ''} disabled={pending} onChange={(e) => run(() => updateTask(taskId, { dueDate: e.target.value || null }))} />

      <label style={labelCls}>Labels</label>
      <input
        className={sel}
        style={{ minWidth: 160 }}
        value={labelText}
        disabled={pending}
        placeholder="comma-separated"
        onChange={(e) => setLabelText(e.target.value)}
        onBlur={() => {
          const next = labelText.split(',').map((l) => l.trim()).filter(Boolean)
          if (next.join('') !== labels.join('')) run(() => updateTask(taskId, { labels: next }))
        }}
      />

      {error ? <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span> : null}
    </div>
  )
}
