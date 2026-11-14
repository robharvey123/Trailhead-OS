'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board, { type BoardSortMode } from '@/components/kanban/Board'
import TaskForm from '@/components/tasks/TaskForm'
import { labelColor } from '@/lib/tags'
import type { EngagementTaskWithRelations } from '@/lib/types'

type Named = { id: string; name: string }

const SORTS: { key: BoardSortMode; label: string }[] = [
  { key: 'manual', label: 'Manual order' },
  { key: 'due_asc', label: 'Due date ↑ (soonest)' },
  { key: 'due_desc', label: 'Due date ↓ (latest)' },
]

export default function EngagementTasksClient({
  engagementId,
  projectId,
  initialTasks,
  minutesByTask,
  people,
  backHref,
}: {
  engagementId: string
  /** When set, this is a project-scoped board: new tasks stamp project_id, no project filter shown. */
  projectId?: string
  initialTasks: EngagementTaskWithRelations[]
  /** Total logged minutes per task id, for the per-card time chip. */
  minutesByTask?: Record<string, number>
  people: Named[]
  /** Source path stamped onto opened tasks so the detail page can offer "Back". */
  backHref: string
}) {
  const [showForm, setShowForm] = useState(false)
  // Engagement view only: 'all' | 'none' (engagement-level) | <projectId>.
  const [scope, setScope] = useState<string>('all')
  const [sortMode, setSortMode] = useState<BoardSortMode>('manual')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [activeLabels, setActiveLabels] = useState<string[]>([])
  const [labelsOpen, setLabelsOpen] = useState(false)
  const labelsRef = useRef<HTMLDivElement>(null)

  const projects = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of initialTasks) if (t.project?.id) map.set(t.project.id, t.project.name)
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [initialTasks])

  const visible = useMemo(() => {
    if (projectId) return initialTasks // already scoped server-side
    if (scope === 'all') return initialTasks
    if (scope === 'none') return initialTasks.filter((t) => !t.project_id)
    return initialTasks.filter((t) => t.project_id === scope)
  }, [initialTasks, projectId, scope])

  // Distinct labels present in the current scope, for the filter dropdown.
  const allLabels = useMemo(() => {
    const set = new Set<string>()
    for (const t of visible) for (const l of t.labels) set.add(l)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [visible])

  // Distinct labels across the whole board (scope-independent), offered when
  // creating a task so the picker isn't affected by the active filter.
  const pickerLabels = useMemo(() => {
    const set = new Set<string>()
    for (const t of initialTasks) for (const l of t.labels) set.add(l)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [initialTasks])

  // Passed down to every memoised card, so it has to keep one identity.
  const toggleLabel = useCallback((label: string) => {
    setActiveLabels((current) =>
      current.includes(label) ? current.filter((l) => l !== label) : [...current, label]
    )
  }, [])

  // Close the labels dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (labelsRef.current && !labelsRef.current.contains(e.target as Node)) setLabelsOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!projectId && projects.length > 0 ? (
            <select className="filter-select" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">All tasks</option>
              <option value="none">Engagement-level only</option>
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          ) : null}
          <select className="filter-select" value={sortMode} onChange={(e) => setSortMode(e.target.value as BoardSortMode)}>
            {SORTS.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
          <label className="filter-date">
            Due from
            <input type="date" className="filter-select" value={dueFrom} max={dueTo || undefined} onChange={(e) => setDueFrom(e.target.value)} />
          </label>
          <label className="filter-date">
            to
            <input type="date" className="filter-select" value={dueTo} min={dueFrom || undefined} onChange={(e) => setDueTo(e.target.value)} />
          </label>
          {dueFrom || dueTo ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDueFrom(''); setDueTo('') }}>Clear dates</button>
          ) : null}

          {allLabels.length > 0 ? (
            <div ref={labelsRef} className="relative">
              <button type="button" className="filter-select" onClick={() => setLabelsOpen((o) => !o)}>
                Labels{activeLabels.length > 0 ? ` (${activeLabels.length})` : ''} ▾
              </button>
              {labelsOpen ? (
                <div className="absolute z-20 mt-1 max-h-[280px] min-w-[200px] overflow-y-auto rounded-control border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[var(--shadow-lg)]">
                  {allLabels.map((l) => {
                    const c = labelColor(l)
                    const active = activeLabels.includes(l)
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => toggleLabel(l)}
                        className={`flex w-full cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs text-[var(--text)] ${active ? 'bg-[var(--surface-2)]' : 'bg-transparent'}`}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-pill" style={{ background: c.solidBg }} />
                        <span className="flex-1 truncate">{l}</span>
                        {active ? <span className="text-[var(--accent-strong)]">✓</span> : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeLabels.map((l) => {
            const c = labelColor(l)
            return (
              <button
                key={l}
                type="button"
                onClick={() => toggleLabel(l)}
                title={`Remove filter: ${l}`}
                // The label's own tint and ink (lib/tags), not white type on its solid hue:
                // white fails contrast on the lighter hues.
                className="inline-flex max-w-[200px] cursor-pointer items-center gap-1.5 truncate rounded-pill px-[9px] py-[3px] text-[11px] font-semibold"
                style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
              >
                {l} ✕
              </button>
            )
          })}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New task</button>
      </div>
      {/* Board keeps its tasks in local state; re-key so a scope change re-seeds it. */}
      <Board
        key={projectId ?? scope}
        initialTasks={visible}
        minutesByTask={minutesByTask}
        fromPath={backHref}
        sortMode={sortMode}
        dueFrom={dueFrom}
        dueTo={dueTo}
        activeLabels={activeLabels}
        onToggleLabel={toggleLabel}
      />
      {showForm ? (
        <TaskForm
          people={people}
          engagements={[]}
          availableLabels={pickerLabels}
          fixedEngagementId={engagementId}
          fixedProjectId={projectId}
          onClose={() => setShowForm(false)}
        />
      ) : null}
    </div>
  )
}
