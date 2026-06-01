'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { TimeEntry } from '@/lib/types'

export default function TimerWidget() {
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isStarting, setIsStarting] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  // Load running timer on mount
  useEffect(() => {
    async function loadTimer() {
      try {
        const response = await apiFetch<{ timer: TimeEntry | null }>('/api/timesheet/timer')
        if (response.timer) {
          setRunning(response.timer)
        }
      } catch (error) {
        console.error('Failed to load running timer:', error)
      }
    }

    loadTimer()
  }, [])

  // Update elapsed time every second
  useEffect(() => {
    if (!running || !running.start_at) return

    const interval = setInterval(() => {
      const now = new Date()
      const start = new Date(running.start_at!)
      const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000)
      setElapsedSeconds(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [running])

  async function handleStartTimer() {
    setIsStarting(true)
    try {
      const response = await apiFetch<{ timer: TimeEntry }>(
        '/api/timesheet/timer',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      setRunning(response.timer)
      setElapsedSeconds(0)
    } catch (error) {
      console.error('Failed to start timer:', error)
    } finally {
      setIsStarting(false)
    }
  }

  async function handleStopTimer() {
    if (!running) return

    setIsStopping(true)
    try {
      await apiFetch<{ entry: TimeEntry }>(
        `/api/timesheet/timer/${running.id}/stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rate_snapshot: running.rate_snapshot }),
        }
      )
      setRunning(null)
      setElapsedSeconds(0)
    } catch (error) {
      console.error('Failed to stop timer:', error)
    } finally {
      setIsStopping(false)
    }
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (running) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#2A2A3A] bg-[#1A1A28] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="font-mono text-sm font-semibold text-white">
            {formatTime(elapsedSeconds)}
          </span>
        </div>
        <button
          onClick={handleStopTimer}
          disabled={isStopping}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isStopping ? 'Stopping...' : 'Stop'}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleStartTimer}
      disabled={isStarting}
      className="rounded-full border border-[#2A2A3A] bg-[#1A1A28] px-4 py-2 text-xs font-medium text-[#9CA3AF] hover:bg-[#232335] disabled:opacity-50"
    >
      {isStarting ? 'Starting...' : 'Start timer'}
    </button>
  )
}
