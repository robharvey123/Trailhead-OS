'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-fetch'
import type { WorkspaceLink } from '@/lib/holding/types'

export default function SettingsClient({ workspaceId }: { workspaceId: string }) {
  const [links, setLinks] = useState<WorkspaceLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [linkedWorkspaceId, setLinkedWorkspaceId] = useState('')
  const [label, setLabel] = useState('')

  const resetForm = () => { setLinkedWorkspaceId(''); setLabel('') }

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ links: WorkspaceLink[] }>(`/api/holding/links?workspace_id=${workspaceId}`)
      setLinks(res.links ?? [])
    } catch { /* silent */ } finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { link } = await apiFetch<{ link: WorkspaceLink }>('/api/holding/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, linked_workspace_id: linkedWorkspaceId, label: label || null }),
      })
      setLinks((prev) => [link, ...prev])
      resetForm(); setShowForm(false)
      toast.success('Workspace linked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setSaving(false) }
  }, [workspaceId, linkedWorkspaceId, label])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/holding/links?workspace_id=${workspaceId}&id=${id}`, { method: 'DELETE' })
      setLinks((prev) => prev.filter((l) => l.id !== id))
      toast.success('Link removed')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to remove') }
  }, [workspaceId])

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Trailhead Holdings</p>
        <h1 className="mt-1 text-2xl font-semibold">Settings</h1>
      </header>

      {/* Linked Workspaces */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Linked Workspaces</h2>
            <p className="mt-1 text-sm text-slate-400">
              Link brand workspaces to pull sell-in data for commission calculations.
            </p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-white">+ Link Workspace</button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Workspace ID *</label>
                <input
                  required
                  value={linkedWorkspaceId}
                  onChange={(e) => setLinkedWorkspaceId(e.target.value)}
                  placeholder="Paste workspace UUID"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. V&YOU UK"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-lg bg-white/90 px-4 py-2 text-xs font-semibold uppercase text-slate-950 hover:bg-white disabled:opacity-50">Link</button>
              <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs uppercase text-slate-300 hover:text-white">Cancel</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />)}
          </div>
        ) : links.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No linked workspaces yet.</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div>
                  <p className="font-medium">{link.label || link.linked_workspace_name || 'Unnamed workspace'}</p>
                  <p className="text-xs text-slate-500 font-mono">{link.linked_workspace_id}</p>
                </div>
                <button onClick={() => handleDelete(link.id)} className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Info */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="mt-2 text-sm text-slate-400">
          The Trailhead Holdings Hub provides a consolidated view of all income streams, expenses,
          bank transactions, and commission earnings across your business. Link brand workspaces
          above to enable cross-workspace commission tracking.
        </p>
      </section>
    </div>
  )
}
