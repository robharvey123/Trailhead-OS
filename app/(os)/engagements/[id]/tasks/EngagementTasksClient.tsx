'use client'

import { useMemo, useState } from 'react'
import Board, { type BoardSortMode } from '@/components/kanban/Board'
import TaskForm from '@/components/tasks/TaskForm'
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
  people,
  backHref,
}: {
  engagementId: string
  /** When set, this is a project-scoped board: new tasks stamp project_id, no project filter shown. */
  projectId?: string
  initialTasks: EngagementTaskWithRelations[]
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New task</button>
      </div>
      {/* Board keeps its tasks in local state; re-key so a scope change re-seeds it. */}
      <Board key={projectId ?? scope} initialTasks={visible} fromPath={backHref} sortMode={sortMode} dueFrom={dueFrom} dueTo={dueTo} />
      {showForm ? (
        <TaskForm
          people={people}
          engagements={[]}
          fixedEngagementId={engagementId}
          fixedProjectId={projectId}
          onClose={() => setShowForm(false)}
        />
      ) : null}
    </div>
  )
}
