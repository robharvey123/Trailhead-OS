'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TaskRow, TaskTemplate } from '@/lib/workspace/types'
import { WORKSPACE_CATEGORY_LABELS, type WorkspaceTaskCategory } from '@/lib/workspace/constants'
import { KanbanBoard } from './kanban-board'
import { ListView } from './list-view'
import { TaskModal } from './task-modal'
import { TemplateDrawer } from './template-drawer'

export type ViewMode = 'kanban' | 'list'
type CategoryFilter = 'all' | WorkspaceTaskCategory

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || res.statusText)
  }
  return res.json()
}

interface WorkspacePageProps {
  workspaceId: string
}

export default function WorkspacePage({ workspaceId }: WorkspacePageProps) {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const [dateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return formatDate(d)
  })
  const [dateTo] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return formatDate(d)
  })

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ workspace_id: workspaceId, date_from: dateFrom, date_to: dateTo })
      const data = await apiFetch<{ tasks: TaskRow[] }>(`/api/tasks?${params}`)
      setTasks(data.tasks)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, dateFrom, dateTo])

  const loadTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      const data = await apiFetch<{ templates: TaskTemplate[] }>(`/api/templates?${params}`)
      setTemplates(data.templates)
    } catch {
      // Templates are non-critical
    }
  }, [workspaceId])

  useEffect(() => {
    loadTasks()
    loadTemplates()
  }, [loadTasks, loadTemplates])

  const filteredTasks = useMemo(() => {
    let filtered = tasks
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [tasks, categoryFilter, searchQuery])

  const handleCreateTask = useCallback(
    async (payload: Record<string, unknown>) => {
      const data = await apiFetch<{ task: TaskRow }>('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, workspace_id: workspaceId }),
      })
      await loadTasks()
      return data.task
    },
    [workspaceId, loadTasks]
  )

  const handleUpdateTask = useCallback(
    async (taskId: string, payload: Record<string, unknown>, scope?: 'single' | 'series') => {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      if (scope === 'series') params.set('scope', 'series')
      const data = await apiFetch<{ task: TaskRow }>(`/api/tasks/${taskId}?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await loadTasks()
      return data.task
    },
    [workspaceId, loadTasks]
  )

  const handleDeleteTask = useCallback(
    async (taskId: string, scope?: 'single' | 'series') => {
      const params = new URLSearchParams({ workspace_id: workspaceId })
      if (scope === 'series') params.set('scope', 'series')
      await apiFetch(`/api/tasks/${taskId}?${params}`, { method: 'DELETE' })
      setSelectedTask(null)
      await loadTasks()
    },
    [workspaceId, loadTasks]
  )

  const handleStatusChange = useCallback(
    async (taskId: string, status: TaskRow['status']) => {
      await handleUpdateTask(taskId, { status })
    },
    [handleUpdateTask]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Tasks</h1>
          <p className="text-sm text-slate-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Templates
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-white"
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-700 text-sm">
          {(['kanban', 'list'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 capitalize transition ${
                viewMode === mode
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              } ${mode === 'kanban' ? 'rounded-l-lg' : 'rounded-r-lg'}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All categories</option>
          {Object.entries(WORKSPACE_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </div>

      {/* Error / Loading */}
      {error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-300">
          {error}
          <button onClick={loadTasks} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {loading && tasks.length === 0 && (
        <div className="py-12 text-center text-slate-500">Loading tasks...</div>
      )}

      {/* Views */}
      {!loading && viewMode === 'kanban' && (
        <KanbanBoard
          tasks={filteredTasks}
          onSelectTask={setSelectedTask}
          onStatusChange={handleStatusChange}
        />
      )}

      {!loading && viewMode === 'list' && (
        <ListView
          tasks={filteredTasks}
          onSelectTask={setSelectedTask}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Task edit/view modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Create task modal */}
      {showCreateModal && (
        <TaskModal
          task={null}
          templates={templates}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateTask}
        />
      )}

      {/* Template drawer */}
      {showTemplates && (
        <TemplateDrawer
          workspaceId={workspaceId}
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onRefresh={loadTemplates}
        />
      )}
    </div>
  )
}
