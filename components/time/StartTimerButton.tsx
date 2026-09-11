'use client'

import { useState } from 'react'
import { useTimer } from './TimerProvider'

// Start the one global timer with links pre-filled from wherever the button
// lives (engagement page, project page, task card). Disabled while another
// timer is live — one timer per user, enforced by the DB.

export default function StartTimerButton({
  engagementId,
  projectId,
  taskId,
  accountId,
  label = '▶ Start timer',
  size = 'sm',
  className,
}: {
  engagementId?: string | null
  projectId?: string | null
  taskId?: string | null
  accountId?: string | null
  label?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const { running, busy, start } = useTimer()
  const [error, setError] = useState('')

  const elsewhere =
    running != null && !(taskId ? running.task_id === taskId : projectId ? running.project_id === projectId : engagementId ? running.engagement_id === engagementId : false)

  async function onStart() {
    setError('')
    try {
      await start({ engagement_id: engagementId ?? null, project_id: projectId ?? null, task_id: taskId ?? null, account_id: accountId ?? null })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the timer')
    }
  }

  const runningLabel = running
    ? running.task?.title ?? running.project?.name ?? running.engagement?.name ?? 'another entry'
    : ''

  return (
    <span title={error || (running && elsewhere ? `Timer running on ${runningLabel}` : undefined)}>
      <button
        type="button"
        className={className ?? `btn btn-primary btn-${size}`}
        onClick={() => void onStart()}
        disabled={busy || running != null}
      >
        {running != null ? '● Timer running' : label}
      </button>
    </span>
  )
}
