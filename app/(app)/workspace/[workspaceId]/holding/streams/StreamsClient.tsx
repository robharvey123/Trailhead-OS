'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { IncomeStream, IncomeStreamType } from '@/lib/holding/types'
import { STREAM_TYPES, STREAM_TYPE_LABELS, STREAM_TYPE_BG_COLORS } from '@/lib/holding/types'

export default function StreamsClient({ workspaceId }: { workspaceId: string }) {
  const [streams, setStreams] = useState<IncomeStream[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  const [name, setName] = useState('')
  const [type, setType] = useState<IncomeStreamType>('consulting')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [isActive, setIsActive] = useState(true)

  const resetForm = () => {
    setName(''); setType('consulting'); setDescription(''); setCurrency('GBP'); setIsActive(true); setEditingId(null)
  }

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ streams: IncomeStream[] }>(`/api/holding/streams?workspace_id=${workspaceId}`)
      setStreams(res.streams)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const openEdit = (s: IncomeStream) => {
    setName(s.name); setType(s.type); setDescription(s.description || '')
    setCurrency(s.currency); setIsActive(s.is_active); setEditingId(s.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { workspace_id: workspaceId, name, type, description: description || null, currency, is_active: isActive }
      if (editingId) {
        const { stream } = await apiFetch<{ stream: IncomeStream }>(`/api/holding/streams/${editingId}?workspace_id=${workspaceId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setStreams((prev) => prev.map((s) => s.id === editingId ? stream : s))
      } else {
        const { stream } = await apiFetch<{ stream: IncomeStream }>('/api/holding/streams', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        setStreams((prev) => [stream, ...prev])
      }
      resetForm(); setShowForm(false)
      toast.success(editingId ? 'Stream updated' : 'Stream created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, editingId, name, type, description, currency, isActive])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/holding/streams/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
      setStreams((prev) => prev.filter((s) => s.id !== id))
      toast.success('Stream deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }, [workspaceId])

  const filtered = streams.filter((s) => filterType === 'all' || s.type === filterType)

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-2 text-2xl font-semibold">Income Streams</h1>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
          <h1 className="mt-1 text-2xl font-semibold">Income Streams</h1>
          <p className="mt-1 text-sm text-slate-400">{streams.length} stream{streams.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Stream</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All types</option>
          {STREAM_TYPES.map((t) => <option key={t} value={t}>{STREAM_TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Stream' : 'New Stream'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as IncomeStreamType)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                  {STREAM_TYPES.map((t) => <option key={t} value={t}>{STREAM_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Currency</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-700" />
              <label htmlFor="is_active" className="text-sm text-slate-300">Active</label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-full py-8 text-center text-slate-500">No streams found</p>
        ) : filtered.map((s) => (
          <div key={s.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{s.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STREAM_TYPE_BG_COLORS[s.type]}`}>
                    {STREAM_TYPE_LABELS[s.type]}
                  </span>
                  {!s.is_active && <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400">Inactive</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                <button onClick={() => handleDelete(s.id)} className="text-xs text-rose-400 hover:text-rose-300">&times;</button>
              </div>
            </div>
            {s.description && <p className="text-sm text-slate-400">{s.description}</p>}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>{s.currency}</span>
              {s.account_name && <span>&middot; {s.account_name}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
