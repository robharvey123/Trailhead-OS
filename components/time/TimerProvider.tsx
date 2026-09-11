'use client'

// THE one timer. Holds the running time_entries row (with its ledger relations)
// for the signed-in user, polls it on mount and on tab focus, and ticks the
// elapsed clock. Every start/stop control in the OS goes through this context,
// so a timer started on a task card is visible (and stoppable) everywhere.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { TimeEntryLedgerRow } from '@/lib/types'

export type StartTimerInput = {
  engagement_id?: string | null
  project_id?: string | null
  task_id?: string | null
  account_id?: string | null
  description?: string | null
}

export type StopTimerPatchInput = {
  description?: string | null
  engagement_id?: string | null
  project_id?: string | null
  task_id?: string | null
  account_id?: string | null
  billable?: boolean
  rate_snapshot?: number
}

type TimerContextValue = {
  running: TimeEntryLedgerRow | null
  elapsedSeconds: number
  busy: boolean
  start: (input: StartTimerInput) => Promise<TimeEntryLedgerRow | null>
  stop: (patch?: StopTimerPatchInput) => Promise<void>
  /** Re-file the RUNNING entry's links without stopping it. */
  assign: (patch: StopTimerPatchInput) => Promise<void>
  refresh: () => Promise<void>
}

const TimerContext = createContext<TimerContextValue | null>(null)

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used inside TimerProvider')
  return ctx
}

export default function TimerProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [running, setRunning] = useState<TimeEntryLedgerRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const loaded = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/timesheet/timer')
      if (!res.ok) return
      const json = await res.json()
      setRunning((json.timer as TimeEntryLedgerRow | null) ?? null)
    } catch {
      /* transient — keep current state */
    }
  }, [])

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true
      void refresh()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Tick once a second only while running.
  useEffect(() => {
    if (!running?.start_at) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running?.start_at])

  const start = useCallback(
    async (input: StartTimerInput) => {
      setBusy(true)
      try {
        const res = await fetch('/api/timesheet/timer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not start the timer')
        // startTimer returns the already-running entry when one exists.
        await refresh()
        return (json.timer as TimeEntryLedgerRow) ?? null
      } finally {
        setBusy(false)
      }
    },
    [refresh]
  )

  const stop = useCallback(
    async (patch: StopTimerPatchInput = {}) => {
      if (!running) return
      setBusy(true)
      try {
        const res = await fetch(`/api/timesheet/timer/${running.id}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not stop the timer')
        setRunning(null)
        router.refresh() // server-rendered totals update
      } finally {
        setBusy(false)
      }
    },
    [running, router]
  )

  const assign = useCallback(
    async (patch: StopTimerPatchInput) => {
      if (!running) return
      const res = await fetch(`/api/timesheet/${running.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not re-file the timer')
      await refresh()
    },
    [running, refresh]
  )

  const elapsedSeconds = running?.start_at ? Math.max(0, Math.floor((now - new Date(running.start_at).getTime()) / 1000)) : 0

  return (
    <TimerContext.Provider value={{ running, elapsedSeconds, busy, start, stop, assign, refresh }}>
      {children}
    </TimerContext.Provider>
  )
}
