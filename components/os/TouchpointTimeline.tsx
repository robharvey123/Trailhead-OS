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

type TimelineTouchpoint = Touchpoint & { link?: 'direct' | 'account' }

export default function TouchpointTimeline({
  initialTouchpoints,
  accountId,
  contactId,
  engagementId,
  readOnly = false,
  title = 'Touchpoints',
  description = 'Log calls, emails, meetings, and messages.',
}: {
  initialTouchpoints: TimelineTouchpoint[]
  accountId?: string | null
  contactId?: string | null
  engagementId?: string | null
  readOnly?: boolean
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
          engagement_id: engagementId ?? null,
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
    <div className="os-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="os-section-title">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--text-2)]">{description}</p>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm()
              }
              setShowForm((current) => !current)
            }}
            className="btn btn-ghost btn-sm"
          >
            {showForm ? 'Cancel' : '+ Log touchpoint'}
          </button>
        )}
      </div>

      {showForm && !readOnly ? (
        <form onSubmit={handleSubmit} className="card mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="field-label">Type</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as TouchpointType)}
                className="filter-select"
                style={{ width: '100%' }}
              >
                {TOUCHPOINT_TYPES.map((entry) => (
                  <option key={entry} value={entry}>
                    {TOUCHPOINT_LABELS[entry]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="field-label">When</span>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="filter-select"
                style={{ width: '100%' }}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="field-label">Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="filter-select"
              style={{ width: '100%' }}
            />
          </label>

          <label className="block space-y-1">
            <span className="field-label">Details</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="os-textarea"
              style={{ width: '100%' }}
            />
          </label>

          <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving…' : 'Save touchpoint'}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      {touchpoints.length === 0 ? (
        <div className="empty mt-4">No touchpoints logged yet.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {touchpoints.map((touchpoint) => (
            <div key={touchpoint.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="channel-tag">{TOUCHPOINT_LABELS[touchpoint.type]}</span>
                    <p className="text-sm font-semibold text-[color:var(--text)]">{touchpoint.subject}</p>
                    {touchpoint.link === 'account' ? (
                      <span className="meta-chip" title="Logged against a related account, not this engagement directly">
                        via account
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[color:var(--text-3)]">
                    {new Date(touchpoint.occurred_at).toLocaleString('en-GB')}
                  </p>
                  {touchpoint.body ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">
                      {touchpoint.body}
                    </p>
                  ) : null}
                </div>
                {readOnly ? null : (
                  <button type="button" onClick={() => handleDelete(touchpoint.id)} className="btn btn-ghost btn-sm">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
