'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { CrmActivity, CrmActivityType } from '@/lib/crm/types'
import { CRM_ACTIVITY_TYPES, CRM_ACTIVITY_TYPE_LABELS } from '@/lib/crm/types'

const TYPE_ICONS: Record<CrmActivityType, string> = {
  call: '📞', email: '✉️', meeting: '🤝', note: '📝', task: '✅',
}

const TYPE_COLORS: Record<CrmActivityType, string> = {
  call: 'border-l-blue-500', email: 'border-l-purple-500', meeting: 'border-l-amber-500',
  note: 'border-l-slate-500', task: 'border-l-emerald-500',
}

export default function ActivityTimeline({
  workspaceId,
  initialActivities,
  accountId,
  contactId,
  dealId,
}: {
  workspaceId: string
  initialActivities: CrmActivity[]
  accountId?: string
  contactId?: string
  dealId?: string
}) {
  const [activities, setActivities] = useState(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [actType, setActType] = useState<CrmActivityType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [actDate, setActDate] = useState(new Date().toISOString().slice(0, 10))

  const resetForm = () => { setActType('note'); setSubject(''); setBody(''); setActDate(new Date().toISOString().slice(0, 10)) }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { activity } = await apiFetch<{ activity: CrmActivity }>('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          account_id: accountId || null,
          contact_id: contactId || null,
          deal_id: dealId || null,
          type: actType,
          subject,
          body: body || null,
          activity_date: actDate,
        }),
      })
      setActivities((prev) => [activity, ...prev])
      resetForm()
      setShowForm(false)
      toast.success('Activity logged')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log activity')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, accountId, contactId, dealId, actType, subject, body, actDate])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/crm/activities/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setActivities((prev) => prev.filter((a) => a.id !== id))
      toast.success('Activity deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium uppercase tracking-[0.15em] text-slate-400">Activity</h3>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="rounded-lg bg-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/20 hover:text-white"
        >
          {showForm ? 'Cancel' : '+ Log Activity'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Type</label>
              <select value={actType} onChange={(e) => setActType(e.target.value as CrmActivityType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm">
                {CRM_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Date</label>
              <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Subject *</label>
            <input required value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Details</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-white disabled:opacity-50">
            {saving ? 'Saving...' : 'Log Activity'}
          </button>
        </form>
      )}

      {activities.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600">No activities yet</p>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className={`rounded-lg border border-slate-800 border-l-4 ${TYPE_COLORS[a.type]} bg-slate-900/40 px-4 py-3`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TYPE_ICONS[a.type]}</span>
                  <span className="text-sm font-medium">{a.subject}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{CRM_ACTIVITY_TYPE_LABELS[a.type]}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500">{a.activity_date}</span>
                  <button onClick={() => handleDelete(a.id)} className="text-[10px] text-slate-600 hover:text-rose-400">✕</button>
                </div>
              </div>
              {a.body && <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{a.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
