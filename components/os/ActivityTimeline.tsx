'use client'

import { useState } from 'react'
import type { Activity, ActivityType } from '@/lib/types'

const ACTIVITY_TYPES: ActivityType[] = ['Email', 'Call', 'Meeting', 'Note', 'Task']

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  Email: '✉',
  Call: '☎',
  Meeting: '👥',
  Note: '📝',
  Task: '☑',
}

export default function ActivityTimeline({
  initialActivities,
  accountId,
  contactId,
}: {
  initialActivities: Activity[]
  accountId?: string | null
  contactId?: string | null
}) {
  const [activities, setActivities] = useState(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [type, setType] = useState<ActivityType>('Note')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')

  function resetForm() {
    setType('Note')
    setSubject('')
    setNotes('')
    setActivityDate(new Date().toISOString().split('T')[0])
    setNextAction('')
    setNextActionDate('')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId ?? null,
          contact_id: contactId ?? null,
          type,
          subject,
          notes,
          activity_date: activityDate,
          next_action: nextAction || null,
          next_action_date: nextActionDate || null,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to log activity')
      }

      setActivities((current) => [data.activity, ...current])
      resetForm()
      setShowForm(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to log activity'
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setError(null)

    try {
      const response = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Failed to delete activity'
        )
      }

      setActivities((current) => current.filter((a) => a.id !== id))
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete activity'
      )
    }
  }

  // Find the next open action
  const nextOpenAction = activities.find(
    (a) => a.next_action && (!a.next_action_date || a.next_action_date >= new Date().toISOString().split('T')[0])
  )

  return (
    <div className="rounded-[2rem] os-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="os-section-title">Activity Log</h2>
          <p className="text-sm text-[color:var(--text-2)]">
            Track emails, calls, meetings, notes, and tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) resetForm()
            setShowForm((current) => !current)
          }}
          className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
        >
          {showForm ? 'Cancel' : 'Log activity'}
        </button>
      </div>

      {nextOpenAction ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--amber)] bg-[var(--amber-dim)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--amber-strong)]">
            Next Action
          </p>
          <p className="mt-1 text-sm text-[color:var(--text)]">{nextOpenAction.next_action}</p>
          {nextOpenAction.next_action_date ? (
            <p className="mt-1 text-xs text-[color:var(--amber-strong)]">
              Due:{' '}
              {new Date(nextOpenAction.next_action_date).toLocaleDateString('en-GB')}
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-[1.5rem] os-card-muted p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="os-select w-full"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Date</span>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="os-input w-full"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="os-input w-full"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[color:var(--text-2)]">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="os-textarea w-full rounded-[1.5rem]"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Next action</span>
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Follow up call"
                className="os-input w-full"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[color:var(--text-2)]">Next action date</span>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="os-input w-full"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save activity'}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-[color:var(--red-strong)]">{error}</p> : null}

      {activities.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--border)] px-4 py-8 text-sm text-[color:var(--text-3)]">
          No activities logged yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-3xl os-card-muted p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">
                      {ACTIVITY_ICONS[activity.type]}
                    </span>
                    <p className="font-medium text-[color:var(--text)]">
                      {activity.subject || activity.type}
                    </p>
                    <span className="rounded-full bg-[var(--surface-3)] px-2 py-1 text-[11px] text-[color:var(--text-2)]">
                      {activity.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--text-3)]">
                    {new Date(activity.activity_date).toLocaleDateString('en-GB')}
                  </p>
                  {activity.notes ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">
                      {activity.notes}
                    </p>
                  ) : null}
                  {activity.next_action ? (
                    <div className="mt-3 rounded-xl border border-[color:var(--amber)] bg-[var(--amber-dim)] px-3 py-2">
                      <p className="text-xs font-medium text-[color:var(--amber-strong)]">
                        Next: {activity.next_action}
                        {activity.next_action_date
                          ? ` (${new Date(activity.next_action_date).toLocaleDateString('en-GB')})`
                          : ''}
                      </p>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(activity.id)}
                  className="flex-shrink-0 rounded-full border border-[color:var(--red)] px-3 py-1 text-xs text-[color:var(--red-strong)] transition hover:bg-[var(--red-dim)]"
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
