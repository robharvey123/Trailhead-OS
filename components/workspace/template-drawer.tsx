'use client'

import { useState } from 'react'
import type { TaskTemplate } from '@/lib/workspace/types'
import { WORKSPACE_CATEGORY_LABELS } from '@/lib/workspace/constants'

interface TemplateDrawerProps {
  workspaceId: string
  templates: TaskTemplate[]
  onClose: () => void
  onRefresh: () => void
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  return res.json()
}

export function TemplateDrawer({ workspaceId, templates, onClose, onRefresh }: TemplateDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('')

  function startEdit(tmpl: TaskTemplate) {
    setEditingId(tmpl.id)
    setEditTitle(tmpl.title)
    setEditDescription(tmpl.description || '')
    setEditCategory(tmpl.category || '')
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return
    setSaving(true)
    setError(null)
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      await apiFetch(`/api/templates/${editingId}?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          category: editCategory || null,
        }),
      })
      setEditingId(null)
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(id: string) {
    setSaving(true)
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      await apiFetch(`/api/templates/${id}?${params}`, { method: 'DELETE' })
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function createTemplate() {
    if (!newTitle.trim()) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          category: newCategory || null,
        }),
      })
      setShowNew(false)
      setNewTitle('')
      setNewDescription('')
      setNewCategory('')
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const CATEGORIES = Object.entries(WORKSPACE_CATEGORY_LABELS)
  const inputClasses = 'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-100">Task Templates</h2>
          <button onClick={onClose} className="text-slate-500 transition hover:text-slate-300">✕</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded-lg border border-rose-800 bg-rose-950/50 p-2 text-xs text-rose-300">{error}</div>
        )}

        <div className="space-y-3 p-5">
          {templates.length === 0 && !showNew && (
            <p className="text-sm text-slate-500">No templates yet.</p>
          )}

          {templates.map((tmpl) =>
            editingId === tmpl.id ? (
              <div key={tmpl.id} className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className={inputClasses}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className={inputClasses}
                />
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">No category</option>
                  {CATEGORIES.map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-950">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-500">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={tmpl.id} className="flex items-start justify-between rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">{tmpl.title}</p>
                  {tmpl.description && <p className="text-xs text-slate-400">{tmpl.description}</p>}
                  {tmpl.category && (
                    <span className="mt-1 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {WORKSPACE_CATEGORY_LABELS[tmpl.category as keyof typeof WORKSPACE_CATEGORY_LABELS] || tmpl.category}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(tmpl)} className="text-xs text-slate-400 transition hover:text-white">
                    Edit
                  </button>
                  <button onClick={() => deleteTemplate(tmpl.id)} className="text-xs text-rose-500 transition hover:text-rose-400">
                    Delete
                  </button>
                </div>
              </div>
            )
          )}

          {showNew ? (
            <div className="space-y-2 rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3">
              <input
                placeholder="Template title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className={inputClasses}
                autoFocus
              />
              <textarea
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className={inputClasses}
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className={inputClasses}
              >
                <option value="">No category</option>
                {CATEGORIES.map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={createTemplate} disabled={saving} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                  {saving ? 'Creating…' : 'Create'}
                </button>
                <button onClick={() => setShowNew(false)} className="text-xs text-slate-500">Cancel</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="w-full rounded-xl border border-dashed border-slate-700 py-2 text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-300"
            >
              + New Template
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
