'use client'

import { useState } from 'react'
import type { Touchpoint, TouchpointType } from '@/lib/types'

const TOUCHPOINT_TYPES: TouchpointType[] = ['call', 'email', 'message', 'meeting', 'note']

const TOUCHPOINT_LABELS: Record<TouchpointType, string> = {
  call: 'Call',
  email: 'Email',
  message: 'Message',
  meeting: 'Meeting',
  note: 'Note',
}

const TOUCHPOINT_ICONS: Record<TouchpointType, string> = {
  call: 'Call',
  email: 'Email',
  message: 'Msg',
  meeting: 'Meet',
  note: 'Note',
}

export default function TouchpointTimeline({
  initialTouchpoints,
  accountId,
  contactId,
  title = 'Touchpoints',
  description = 'Log calls, emails, meetings, and messages.',
}: {
  initialTouchpoints: Touchpoint[]
  accountId?: string | null
  contactId?: string | null
  title?: string
  description?: string
}) {
  const [touchpoints, setTouchpoints] = useState(initialTouchpoints)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<TouchpointType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16))

  function resetForm() {
    setType('note')
    setSubject('')
    setBody('')
    setOccurredAt(new Date().toISOString().slice(0, 16))
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!subject.trim()) {
      setError('Subject is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/touchpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId ?? null,
          contact_id: contactId ?? null,
          type,
          subject,
          body,
          occurred_at: new Date(occurredAt).toISOString(),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log touchpoint')
      }

      setTouchpoints((current) => [data.touchpoint, ...current])
      resetForm()
      setShowForm(false)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to log touchpoint')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)

    try {
      const response = await fetch(`/api/touchpoints/${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete touchpoint')
      }

      setTouchpoints((current) => current.filter((touchpoint) => touchpoint.id !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete touchpoint')
    }
  }

  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm()
            }
            setShowForm((current) => !current)
          }}
          className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
        >
          {showForm ? 'Cancel' : 'Log touchpoint'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-[1.5rem] border border-slate-800 bg-slate-950/60 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-slate-300">Type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as TouchpointType)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              >
                {TOUCHPOINT_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {TOUCHPOINT_LABELS[entry]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-300">When</span>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-slate-300">Details</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="w-full rounded-[1.5rem] border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save touchpoint'}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {touchpoints.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-slate-700 px-4 py-8 text-sm text-slate-500">
          No touchpoints logged yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {touchpoints.map((touchpoint) => (
            <div
              key={touchpoint.id}
              className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300">
                      {TOUCHPOINT_ICONS[touchpoint.type]}
                    </span>
                    <p className="font-medium text-slate-100">{touchpoint.subject}</p>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-400">
                      {TOUCHPOINT_LABELS[touchpoint.type]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(touchpoint.occurred_at).toLocaleString('en-GB')}
                  </p>
                  {touchpoint.body ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">
                      {touchpoint.body}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(touchpoint.id)}
                  className="rounded-full border border-rose-500/20 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
