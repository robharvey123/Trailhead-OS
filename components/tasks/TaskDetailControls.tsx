'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignTask, moveTask } from '@/app/(os)/my-work/actions'
import {
  ENGAGEMENT_TASK_STATUSES,
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTaskStatus,
} from '@/lib/types'

type Named = { id: string; name: string }

export default function TaskDetailControls({
  taskId,
  status,
  position,
  assigneePersonId,
  people,
}: {
  taskId: string
  status: EngagementTaskStatus
  position: number
  assigneePersonId: string | null
  people: Named[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function run(fn: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      const res = await fn()
      if (res.error) setError(res.error)
      else { setError(''); router.refresh() }
    })
  }

  const sel = 'filter-select'
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>Status</label>
      <select className={sel} value={status} disabled={pending} onChange={(e) => run(() => moveTask(taskId, e.target.value as EngagementTaskStatus, position))}>
        {ENGAGEMENT_TASK_STATUSES.map((s) => (<option key={s} value={s}>{ENGAGEMENT_TASK_STATUS_LABELS[s]}</option>))}
      </select>
      <label style={{ fontSize: 12, color: 'var(--text-3)' }}>Assignee</label>
      <select className={sel} value={assigneePersonId ?? ''} disabled={pending} onChange={(e) => run(() => assignTask(taskId, e.target.value || null))}>
        <option value="">— unassigned</option>
        {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
      </select>
      {error ? <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span> : null}
    </div>
  )
}
