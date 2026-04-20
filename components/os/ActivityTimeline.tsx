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
    <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Activity Log</h2>
          <p className="text-sm text-[#9CA3AF]">
            Track emails, calls, meetings, notes, and tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showForm) resetForm()
            setShowForm((current) => !current)
          }}
          className="rounded-2xl border border-[#2A2A3A] px-4 py-2 text-sm text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
        >
          {showForm ? 'Cancel' : 'Log activity'}
        </button>
      </div>

      {nextOpenAction ? (
        <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Next Action
          </p>
          <p className="mt-1 text-sm text-white">{nextOpenAction.next_action}</p>
          {nextOpenAction.next_action_date ? (
            <p className="mt-1 text-xs text-amber-200/80">
              Due:{' '}
              {new Date(nextOpenAction.next_action_date).toLocaleDateString('en-GB')}
            </p>
          ) : null}
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-[1.5rem] border border-[#2A2A3A] bg-[#13131E] p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-[#9CA3AF]">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
              >
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[#9CA3AF]">Date</span>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm text-[#9CA3AF]">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-[#9CA3AF]">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-[1.5rem] border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-[#9CA3AF]">Next action</span>
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Follow up call"
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-[#9CA3AF]">Next action date</span>
              <input
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="w-full rounded-2xl border border-[#2A2A3A] bg-[#0C0C14] px-4 py-3 text-sm text-white"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save activity'}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

      {activities.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[#2A2A3A] px-4 py-8 text-sm text-white0">
          No activities logged yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-3xl border border-[#2A2A3A] bg-[#13131E] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">
                      {ACTIVITY_ICONS[activity.type]}
                    </span>
                    <p className="font-medium text-white">
                      {activity.subject || activity.type}
                    </p>
                    <span className="rounded-full bg-[#2A2A3A] px-2 py-1 text-[11px] text-[#9CA3AF]">
                      {activity.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white0">
                    {new Date(activity.activity_date).toLocaleDateString('en-GB')}
                  </p>
                  {activity.notes ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[#9CA3AF]">
                      {activity.notes}
                    </p>
                  ) : null}
                  {activity.next_action ? (
                    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <p className="text-xs font-medium text-amber-200">
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
                  className="flex-shrink-0 rounded-full border border-rose-500/20 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400"
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
