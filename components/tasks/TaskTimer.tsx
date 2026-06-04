'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  initialRunning,
  loggedMinutes,
}: {
  taskId: string
  projectId: string | null
  engagementId: string | null
  initialRunning: TimeEntry | null
  loggedMinutes: number
}) {
  const router = useRouter()
  const [running, setRunning] = useState<TimeEntry | null>(initialRunning)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)

  const onThisTask = running?.task_id === taskId
  const elsewhere = running != null && !onThisTask

  // Tick every second only while OUR task's timer is live.
  useEffect(() => {
    if (onThisTask && running?.start_at) {
      setNow(Date.now())
      tick.current = setInterval(() => setNow(Date.now()), 1000)
      return () => { if (tick.current) clearInterval(tick.current) }
    }
  }, [onThisTask, running?.start_at])

  const elapsedSeconds = onThisTask && running?.start_at ? (now - new Date(running.start_at).getTime()) / 1000 : 0

  async function start() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/timesheet/timer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, project_id: projectId, engagement_id: engagementId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not start the timer.'); return }
      // startTimer returns the existing running timer if one was already going,
      // which may belong to another task — the UI reflects that.
      setRunning(json.timer as TimeEntry)
      router.refresh()
    } catch {
      setError('Could not start the timer.')
    } finally {
      setBusy(false)
    }
  }

  async function stop() {
    if (!running) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/timesheet/timer/${running.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not stop the timer.'); return }
      setRunning(null)
      router.refresh()
    } catch {
      setError('Could not stop the timer.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="field-label">Logged</span>
        <span className="td-mono" style={{ fontSize: 13, color: 'var(--text)' }}>{fmtMinutes(loggedMinutes)}</span>
      </div>

      {onThisTask ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="td-mono" style={{ fontSize: 20, color: 'var(--accent)' }}>{fmtElapsed(elapsedSeconds)}</span>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red-strong)', borderColor: 'var(--red)' }} onClick={stop} disabled={busy}>
            {busy ? 'Stopping…' : '■ Stop'}
          </button>
        </div>
      ) : elsewhere ? (
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          A timer is already running on another task. Stop it there before timing this one.
        </p>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={start} disabled={busy} style={{ justifySelf: 'start' }}>
          {busy ? 'Starting…' : '▶ Start timer'}
        </button>
      )}

      {error ? <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p> : null}
    </div>
  )
}
