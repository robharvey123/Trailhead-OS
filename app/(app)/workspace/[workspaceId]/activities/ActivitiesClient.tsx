'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { CrmActivity, CrmActivityType } from '@/lib/crm/types'
import { CRM_ACTIVITY_TYPES, CRM_ACTIVITY_TYPE_LABELS } from '@/lib/crm/types'

type AccountOption = { id: string; name: string }
type ContactOption = { id: string; name: string; account_id: string | null }
type DealOption = { id: string; title: string; account_id: string | null }

const ACTIVITY_TYPE_ICONS: Record<CrmActivityType, string> = {
  call: '📞', email: '✉️', meeting: '🤝', note: '📝', task: '✅',
}

export default function ActivitiesClient({
  workspaceId, initialActivities, accounts, contacts, deals,
}: {
  workspaceId: string; initialActivities: CrmActivity[]; accounts: AccountOption[]
  contacts: ContactOption[]; deals: DealOption[]
}) {
  const [activities, setActivities] = useState(initialActivities)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [search, setSearch] = useState('')

  // Form
  const [type, setType] = useState<CrmActivityType>('note')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [activityDate, setActivityDate] = useState(new Date().toISOString().slice(0, 10))
  const [accountId, setAccountId] = useState('')
  const [contactId, setContactId] = useState('')
  const [dealId, setDealId] = useState('')

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]))
  const contactMap = new Map(contacts.map((c) => [c.id, c.name]))
  const dealMap = new Map(deals.map((d) => [d.id, d.title]))

  const resetForm = () => {
    setType('note'); setSubject(''); setBody(''); setActivityDate(new Date().toISOString().slice(0, 10))
    setAccountId(''); setContactId(''); setDealId('')
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        workspace_id: workspaceId, type, subject, body: body || null,
        activity_date: activityDate, account_id: accountId || null,
        contact_id: contactId || null, deal_id: dealId || null,
      }
      const { activity } = await apiFetch<{ activity: CrmActivity }>('/api/crm/activities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      setActivities((prev) => [activity, ...prev])
      resetForm(); setShowForm(false)
      toast.success('Activity logged')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, type, subject, body, activityDate, accountId, contactId, dealId])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/crm/activities/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setActivities((prev) => prev.filter((a) => a.id !== id))
      toast.success('Activity deleted')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to delete') }
  }, [workspaceId])

  const filtered = useMemo(() => activities.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false
    if (filterAccount !== 'all' && a.account_id !== filterAccount) return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.subject.toLowerCase().includes(q) && !(a.body || '').toLowerCase().includes(q)) return false
    }
    return true
  }), [activities, filterType, filterAccount, search])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, CrmActivity[]>()
    for (const a of filtered) {
      const date = a.activity_date
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(a)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">CRM</p>
          <h1 className="mt-1 text-2xl font-semibold">Activities</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} activities</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Log Activity</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activities…" className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-white/30" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Types</option>
          {CRM_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
          <option value="all">All Accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
          <h2 className="text-lg font-semibold">Log Activity</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as CrmActivityType)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                {CRM_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Subject *</label><input value={subject} onChange={(e) => setSubject(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Date</label><input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Account</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Contact</label>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="">—</option>
                {(accountId ? contacts.filter((c) => c.account_id === accountId) : contacts).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-slate-400 mb-1">Deal</label>
              <select value={dealId} onChange={(e) => setDealId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm">
                <option value="">—</option>
                {(accountId ? deals.filter((d) => d.account_id === accountId) : deals).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          </div>
          <div><label className="block text-xs text-slate-400 mb-1">Details</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-sm" /></div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white disabled:opacity-50">{saving ? 'Saving…' : 'Log Activity'}</button>
            <button type="button" onClick={() => { resetForm(); setShowForm(false) }} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs uppercase tracking-wide text-slate-400 hover:text-white">Cancel</button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 py-16">
          <div className="mb-3 text-4xl text-slate-600">📋</div>
          <p className="text-slate-400">No activities recorded yet</p>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="mt-3 text-xs text-blue-400 hover:underline">Log your first activity</button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{date}</h3>
              <div className="space-y-2">
                {items.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700">
                    <span className="mt-0.5 text-lg">{ACTIVITY_TYPE_ICONS[a.type] || '📝'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">{CRM_ACTIVITY_TYPE_LABELS[a.type]}</span>
                        <span className="font-medium">{a.subject}</span>
                      </div>
                      {a.body && <p className="mt-1 text-sm text-slate-400 line-clamp-2">{a.body}</p>}
                      <div className="mt-1 flex gap-3 text-xs text-slate-500">
                        {a.account_id && <span>{accountMap.get(a.account_id)}</span>}
                        {a.contact_id && <span>{contactMap.get(a.contact_id)}</span>}
                        {a.deal_id && <span>{dealMap.get(a.deal_id)}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(a.id)} className="text-xs text-slate-500 hover:text-rose-400">×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
