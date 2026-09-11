'use client'

// The global running-timer indicator, rendered in the Topbar on every OS page.
// Hidden when nothing is running. Shows where the time is going (engagement ›
// project › task), a Stop button, and Assign… to re-file the running entry
// without stopping it.

import { useState } from 'react'
import { useTimer } from './TimerProvider'
import LogTimeButton from './LogTimeButton'

function fmtClock(s: number) {
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':')
}

export default function TimerBar() {
  const { running, elapsedSeconds, busy, stop } = useTimer()
  const [error, setError] = useState('')

  if (!running) return null

  const parts = [
    running.engagement ? running.engagement.code ?? running.engagement.name : null,
    running.project?.name ?? null,
    running.task?.title ?? null,
  ].filter(Boolean) as string[]
  const unassigned = !running.engagement_id && !running.project_id

  async function onStop() {
    setError('')
    try {
      await stop()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not stop the timer')
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-2.5 py-1 text-sm" title={error || undefined}>
      <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#DC2626]" />
      <span className="os-mono shrink-0 tabular-nums text-[color:var(--text)]">{fmtClock(elapsedSeconds)}</span>
      <span className="hidden max-w-[26rem] truncate text-[color:var(--text-3)] md:inline">
        {unassigned ? <span className="font-medium text-[#B45309]">Unassigned</span> : parts.join(' › ')}
      </span>
      <LogTimeButton
        mode="assign"
        assignEntry={running}
        label="Assign…"
        className="hidden shrink-0 text-xs text-[color:var(--text-3)] underline-offset-2 hover:underline sm:inline"
      />
      <button
        type="button"
        onClick={() => void onStop()}
        disabled={busy}
        className="shrink-0 rounded-lg border border-[#FCA5A5] px-2 py-0.5 text-xs font-medium text-[#DC2626] transition hover:bg-[#FEF2F2] disabled:opacity-50"
      >
        {busy ? '…' : '■ Stop'}
      </button>
    </div>
  )
}
