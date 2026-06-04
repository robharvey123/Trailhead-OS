'use client'

import { useMemo, useState } from 'react'
import Board from '@/components/kanban/Board'
import TaskForm from '@/components/tasks/TaskForm'
import type { EngagementTaskWithRelations } from '@/lib/types'

type Named = { id: string; name: string }

export default function EngagementTasksClient({
  engagementId,
  projectId,
  initialTasks,
  people,
}: {
  engagementId: string
  /** When set, this is a project-scoped board: new tasks stamp project_id, no project filter shown. */
  projectId?: string
  initialTasks: EngagementTaskWithRelations[]
  people: Named[]
}) {
  const [showForm, setShowForm] = useState(false)
  // Engagement view only: 'all' | 'none' (engagement-level) | <projectId>.
  const [scope, setScope] = useState<string>('all')

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {!projectId && projects.length > 0 ? (
          <select className="filter-select" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All tasks</option>
            <option value="none">Engagement-level only</option>
            {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        ) : <span />}
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New task</button>
      </div>
      {/* Board keeps its tasks in local state; re-key so a scope change re-seeds it. */}
      <Board key={projectId ?? scope} initialTasks={visible} />
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
