'use client'

// Task-card timer, now a thin skin over the global TimerProvider: starting here
// lights the TimerBar on every OS page, and the server resolver fills the
// account (and anything else derivable) on the entry.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTimer } from '@/components/time/TimerProvider'
import type { TimeEntry } from '@/lib/types'

/** Live HH:MM:SS for a running timer. */
function fmtElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** "2h 15m" / "45m" / "0m" for an accumulated minute total. */
function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

export default function TaskTimer({
  taskId,
  projectId,
  engagementId,
  loggedMinutes,
}: {
  taskId: string
  projectId: string | null
  engagementId: string | null
  /** Kept for callers that still pass it; the provider is the source of truth. */
  initialRunning?: TimeEntry | null
  loggedMinutes: number
}) {
  const router = useRouter()
  const { running, elapsedSeconds, busy, start, stop } = useTimer()
  const [error, setError] = useState('')

  const onThisTask = running?.task_id === taskId
  const elsewhere = running != null && !onThisTask

  async function onStart() {
    setError('')
    try {
      await start({ task_id: taskId, project_id: projectId, engagement_id: engagementId })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the timer.')
    }
  }

  async function onStop() {
    setError('')
    try {
      await stop()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop the timer.')
    }
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="field-label">Logged</span>
        <span className="text-[13px] tabular-nums text-[var(--text)]">{fmtMinutes(loggedMinutes)}</span>
      </div>

      {onThisTask ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl tabular-nums text-[var(--accent-strong)]">{fmtElapsed(elapsedSeconds)}</span>
          <button className="btn btn-danger btn-sm" onClick={() => void onStop()} disabled={busy}>
            {busy ? 'Stopping…' : '■ Stop'}
          </button>
        </div>
      ) : elsewhere ? (
        <p className="text-xs text-[var(--text-3)]">
          A timer is already running on another task. Stop it from the bar above before timing this one.
        </p>
      ) : (
        <button className="btn btn-primary btn-sm justify-self-start" onClick={() => void onStart()} disabled={busy}>
          {busy ? 'Starting…' : '▶ Start timer'}
        </button>
      )}

      {error ? <p className="text-xs text-[var(--red)]">{error}</p> : null}
    </div>
  )
}
