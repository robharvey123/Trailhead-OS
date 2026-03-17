'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { MarketingContent, ContentType, ContentStatus, ContentChannel } from '@/lib/marketing/types'
import { CONTENT_TYPES, CONTENT_STATUSES, CONTENT_STATUS_LABELS, CONTENT_CHANNELS, CONTENT_CHANNEL_LABELS } from '@/lib/marketing/types'

type CampaignOption = { id: string; name: string }

export default function ContentClient({ workspaceId, initialContent, campaigns }: { workspaceId: string; initialContent: MarketingContent[]; campaigns: CampaignOption[] }) {
  const [content, setContent] = useState(initialContent)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [title, setTitle] = useState('')
  const [contentType, setContentType] = useState<ContentType>('post')
  const [channel, setChannel] = useState<ContentChannel | ''>('')
  const [campaignId, setCampaignId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [status, setStatus] = useState<ContentStatus>('idea')
  const [body, setBody] = useState('')

  const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]))
  const resetForm = () => { setTitle(''); setContentType('post'); setChannel(''); setCampaignId(''); setScheduledDate(''); setScheduledTime(''); setStatus('idea'); setBody(''); setEditingId(null) }

  const openEdit = (c: MarketingContent) => {
    setTitle(c.title); setContentType(c.content_type); setChannel(c.channel || ''); setCampaignId(c.campaign_id || '')
    setScheduledDate(c.scheduled_date || ''); setScheduledTime(c.scheduled_time || ''); setStatus(c.status); setBody(c.body || '')
    setEditingId(c.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
    const payload = {
      workspace_id: workspaceId, title, content_type: contentType, channel: channel || null,
      campaign_id: campaignId || null, scheduled_date: scheduledDate || null, scheduled_time: scheduledTime || null,
      status, body: body || null,
    }
    if (editingId) {
      const { content: updated } = await apiFetch<{ content: MarketingContent }>(`/api/marketing/content/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setContent((prev) => prev.map((c) => c.id === editingId ? updated : c))
    } else {
      const { content: created } = await apiFetch<{ content: MarketingContent }>('/api/marketing/content', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setContent((prev) => [...prev, created])
    }
    resetForm(); setShowForm(false)
    toast.success(editingId ? 'Content updated' : 'Content created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [workspaceId, editingId, title, contentType, channel, campaignId, scheduledDate, scheduledTime, status, body])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/marketing/content/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setContent((prev) => prev.filter((c) => c.id !== id))
      toast.success('Content deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = content.filter((c) => filterStatus === 'all' || c.status === filterStatus)

  // Group content by date for calendar view
  const contentByDate = useMemo(() => {
    const map = new Map<string, MarketingContent[]>()
    for (const c of filtered) {
      const key = c.scheduled_date || 'unscheduled'
      const arr = map.get(key) || []
      arr.push(c)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Marketing</p>
          <h1 className="mt-1 text-2xl font-semibold">Content Calendar</h1>
          <p className="mt-1 text-sm text-slate-400">{content.length} piece{content.length !== 1 ? 's' : ''} of content</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Content</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-700 text-sm">
          {(['calendar', 'list'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-3 py-1.5 capitalize transition ${viewMode === m ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'} ${m === 'calendar' ? 'rounded-l-lg' : 'rounded-r-lg'}`}>{m}</button>
          ))}
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Content' : 'New Content'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs text-slate-400">Title *</label><input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">Type</label><select value={contentType} onChange={(e) => setContentType(e.target.value as ContentType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{CONTENT_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Channel</label><select value={channel} onChange={(e) => setChannel(e.target.value as ContentChannel)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{CONTENT_CHANNELS.map((c) => <option key={c} value={c}>{CONTENT_CHANNEL_LABELS[c]}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Campaign</label><select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-400">Scheduled Date</label><input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as ContentStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{CONTENT_STATUSES.map((s) => <option key={s} value={s}>{CONTENT_STATUS_LABELS[s]}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-400">Body / Copy</label><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="space-y-4">
          {contentByDate.map(([date, items]) => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{date === 'unscheduled' ? 'Unscheduled' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
              <div className="flex flex-col gap-2">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-slate-400">{c.content_type} {c.channel ? `· ${CONTENT_CHANNEL_LABELS[c.channel]}` : ''} {c.campaign_id ? <>{' · '}<Link href={`/workspace/${workspaceId}/campaigns`} className="hover:text-white hover:underline">{campaignMap.get(c.campaign_id)}</Link></> : ''}</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase">{CONTENT_STATUS_LABELS[c.status]}</span>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(c)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-xs text-rose-400 hover:text-rose-300">Del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {contentByDate.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No content found</p>}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No content found</td></tr> : filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium">{c.title}</td>
                  <td className="px-4 py-3 text-slate-400">{c.content_type}</td>
                  <td className="px-4 py-3 text-slate-400">{c.channel ? CONTENT_CHANNEL_LABELS[c.channel] : '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{c.scheduled_date || '—'}</td>
                  <td className="px-4 py-3"><span className="rounded-full border border-slate-700 px-2 py-0.5 text-xs">{CONTENT_STATUS_LABELS[c.status]}</span></td>
                  <td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => openEdit(c)} className="text-xs text-slate-400 hover:text-white">Edit</button><button onClick={() => handleDelete(c.id)} className="text-xs text-rose-400 hover:text-rose-300">Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
