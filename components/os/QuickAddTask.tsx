'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-fetch'
import type { TaskWithWorkstream } from '@/lib/types'

interface QuickAddTaskProps {
  workstreamId?: string | null
  workstream_id?: string | null
  columnId?: string | null
  account_id?: string | null
  contact_id?: string | null
  isMasterTodo?: boolean
  placeholder?: string
  buttonLabel?: string
  className?: string
  onCreated?: (task: TaskWithWorkstream) => void | Promise<void>
}

export default function QuickAddTask({
  workstreamId = null,
  workstream_id = null,
  columnId = null,
  account_id = null,
  contact_id = null,
  isMasterTodo,
  placeholder = 'Add a task...',
  buttonLabel = 'Add',
  className = '',
  onCreated,
}: QuickAddTaskProps) {
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()

    if (!nextTitle || submitting) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const resolvedWorkstreamId = workstream_id ?? workstreamId
      const response = await apiFetch<{ task: TaskWithWorkstream }>('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nextTitle,
          workstream_id: resolvedWorkstreamId,
          column_id: columnId,
          account_id,
          contact_id,
          is_master_todo: isMasterTodo ?? !resolvedWorkstreamId,
        }),
      })

      setTitle('')
      await onCreated?.(response.task)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to add task')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className={`relative z-10 space-y-2 pointer-events-auto ${className}`.trim()}
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || !title.trim()}
          className="pointer-events-auto rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Adding...' : buttonLabel}
        </button>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </form>
  )
}
