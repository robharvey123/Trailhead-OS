'use client'

import { useCallback, useState } from 'react'
import type { ProductLaunch, LaunchStatus, LaunchChecklistItem } from '@/lib/products/types'
import { LAUNCH_STATUSES, LAUNCH_STATUS_LABELS, LAUNCH_STATUS_COLORS } from '@/lib/products/types'

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) { const body = await res.json().catch(() => ({ error: res.statusText })); throw new Error(body.error || res.statusText) }
  return res.json()
}

type ProductOption = { id: string; name: string }

export default function LaunchesClient({ workspaceId, initialLaunches, products }: { workspaceId: string; initialLaunches: ProductLaunch[]; products: ProductOption[] }) {
  const [launches, setLaunches] = useState(initialLaunches)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [title, setTitle] = useState('')
  const [productId, setProductId] = useState('')
  const [description, setDescription] = useState('')
  const [launchDate, setLaunchDate] = useState('')
  const [status, setStatus] = useState<LaunchStatus>('planning')
  const [checklist, setChecklist] = useState<LaunchChecklistItem[]>([])

  const resetForm = () => { setTitle(''); setProductId(''); setDescription(''); setLaunchDate(''); setStatus('planning'); setChecklist([]); setEditingId(null) }

  const addChecklistItem = () => setChecklist((prev) => [...prev, { id: crypto.randomUUID(), title: '', done: false }])
  const removeChecklistItem = (id: string) => setChecklist((prev) => prev.filter((i) => i.id !== id))
  const updateChecklistItem = (id: string, field: string, value: string | boolean) => {
    setChecklist((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i))
  }

  const openEdit = (l: ProductLaunch) => {
    setTitle(l.title); setProductId(l.product_id || ''); setDescription(l.description || '')
    setLaunchDate(l.launch_date || ''); setStatus(l.status); setChecklist(l.checklist || [])
    setEditingId(l.id); setShowForm(true)
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { workspace_id: workspaceId, title, product_id: productId || null, description: description || null, launch_date: launchDate || null, status, checklist }
    if (editingId) {
      const { launch } = await apiFetch<{ launch: ProductLaunch }>(`/api/products/launches/${editingId}?workspace_id=${workspaceId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setLaunches((prev) => prev.map((l) => l.id === editingId ? { ...launch, product_name: products.find((p) => p.id === launch.product_id)?.name } : l))
    } else {
      const { launch } = await apiFetch<{ launch: ProductLaunch }>('/api/products/launches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      setLaunches((prev) => [{ ...launch, product_name: products.find((p) => p.id === launch.product_id)?.name }, ...prev])
    }
    resetForm(); setShowForm(false)
  }, [workspaceId, editingId, title, productId, description, launchDate, status, checklist, products])

  const handleDelete = useCallback(async (id: string) => {
    await apiFetch(`/api/products/launches/${id}?workspace_id=${workspaceId}`, { method: 'DELETE' })
    setLaunches((prev) => prev.filter((l) => l.id !== id))
  }, [workspaceId])

  const filtered = launches.filter((l) => filterStatus === 'all' || l.status === filterStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products</p>
          <h1 className="mt-1 text-2xl font-semibold">Launches</h1>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} launches</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ New Launch</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200">
          <option value="all">All statuses</option>
          {LAUNCH_STATUSES.map((s) => <option key={s} value={s}>{LAUNCH_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Launch' : 'New Launch'}</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="mb-1 block text-xs text-slate-400">Title *</label><input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Product</label><select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="">None</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-400">Launch Date</label><input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-slate-400">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as LaunchStatus)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">{LAUNCH_STATUSES.map((s) => <option key={s} value={s}>{LAUNCH_STATUS_LABELS[s]}</option>)}</select></div>
            </div>
            <div><label className="mb-1 block text-xs text-slate-400">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /></div>
            <div>
              <div className="flex items-center justify-between mb-2"><label className="text-xs text-slate-400">Checklist</label><button type="button" onClick={addChecklistItem} className="text-xs text-blue-400 hover:text-blue-300">+ Add item</button></div>
              {checklist.map((item) => (
                <div key={item.id} className="mb-2 flex items-center gap-2">
                  <input type="checkbox" checked={item.done} onChange={(e) => updateChecklistItem(item.id, 'done', e.target.checked)} className="rounded" />
                  <input value={item.title} onChange={(e) => updateChecklistItem(item.id, 'title', e.target.value)} placeholder="Checklist item…" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" />
                  <button type="button" onClick={() => removeChecklistItem(item.id)} className="text-xs text-rose-400 hover:text-rose-300">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white">{editingId ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? <p className="col-span-full text-center text-slate-500 py-8">No launches found</p> : filtered.map((l) => {
          const done = l.checklist?.filter((i) => i.done).length || 0
          const total = l.checklist?.length || 0
          return (
            <div key={l.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{l.title}</h3>
                  <p className="text-xs text-slate-400">{l.product_name || 'No product'} {l.launch_date ? `· ${l.launch_date}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(l)} className="text-xs text-slate-400 hover:text-white">Edit</button>
                  <button onClick={() => handleDelete(l.id)} className="text-xs text-rose-400 hover:text-rose-300">×</button>
                </div>
              </div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${LAUNCH_STATUS_COLORS[l.status]}`}>{LAUNCH_STATUS_LABELS[l.status]}</span>
              {l.description && <p className="text-sm text-slate-400 line-clamp-2">{l.description}</p>}
              {total > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400"><span>Checklist</span><span>{done}/{total}</span></div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
