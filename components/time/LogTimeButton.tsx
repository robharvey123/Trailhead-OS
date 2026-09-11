'use client'

// Opens TimeEntryForm with the given links locked. Fetches the option lists
// lazily so any page can mount this without prop-drilling accounts / projects /
// engagements / people / tasks. The form itself is loaded dynamically (no SSR)
// to avoid hydration mismatches from its new Date() defaults.

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TimeEntryLedgerRow, TimeEntry } from '@/lib/types'
import type { TimeEntryFormOptions } from '@/components/os/TimeEntryForm'
import { useTimer } from './TimerProvider'

const TimeEntryForm = dynamic(() => import('@/components/os/TimeEntryForm'), { ssr: false })

export default function LogTimeButton({
  engagementId,
  projectId,
  taskId,
  label = '+ Log time',
  size = 'sm',
  className,
  mode = 'entry',
  assignEntry = null,
  onSaved,
}: {
  engagementId?: string | null
  projectId?: string | null
  taskId?: string | null
  label?: string
  size?: 'sm' | 'md'
  className?: string
  /** 'assign' re-files a RUNNING entry's links without stopping it. */
  mode?: 'entry' | 'assign'
  assignEntry?: TimeEntryLedgerRow | null
  onSaved?: (entry: TimeEntry) => void
}) {
  const router = useRouter()
  const { refresh } = useTimer()
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<TimeEntryFormOptions | null>(null)
  const [loading, setLoading] = useState(false)

  async function openForm() {
    setOpen(true)
    if (!options && !loading) {
      setLoading(true)
      try {
        const res = await fetch('/api/timesheet/options')
        if (res.ok) setOptions((await res.json()) as TimeEntryFormOptions)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <>
      <button type="button" className={className ?? `btn btn-ghost btn-${size}`} onClick={() => void openForm()}>
        {label}
      </button>
      {open && options ? (
        <TimeEntryForm
          entry={mode === 'assign' ? assignEntry : null}
          mode={mode}
          lock={{ engagement_id: engagementId ?? undefined, project_id: projectId ?? undefined, task_id: taskId ?? undefined }}
          accounts={options.accounts}
          projects={options.projects}
          engagements={options.engagements}
          people={options.people}
          tasks={options.tasks}
          defaultPersonId={options.defaultPersonId}
          onClose={() => setOpen(false)}
          onSaved={(entry) => {
            onSaved?.(entry)
            void refresh()
            router.refresh()
          }}
          onDeleted={() => {
            void refresh()
            router.refresh()
          }}
        />
      ) : null}
    </>
  )
}
