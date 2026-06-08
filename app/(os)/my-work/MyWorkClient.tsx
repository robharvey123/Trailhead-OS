'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskForm from '@/components/tasks/TaskForm'
import {
  ENGAGEMENT_TASK_PRIORITY_LABELS,
  ENGAGEMENT_TASK_PRIORITY_RANK,
  ENGAGEMENT_TASK_STATUSES,
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTask,
  type EngagementTaskPriority,
  type EngagementTaskStatus,
  type EngagementTaskWithRelations,
} from '@/lib/types'

type Named = { id: string; name: string }
const TABS = [
  { key: 'assigned', label: 'Assigned to me' },
  { key: 'reported', label: 'Reported by me' },
  { key: 'engagements', label: 'All my engagements' },
] as const
type TabKey = (typeof TABS)[number]['key']

const SORTS = [
  { key: 'due_asc', label: 'Due date ↑ (soonest)' },
  { key: 'due_desc', label: 'Due date ↓ (latest)' },
  { key: 'created_desc', label: 'Newest first' },
  { key: 'created_asc', label: 'Oldest first' },
] as const
type SortKey = (typeof SORTS)[number]['key']

/** due_date compare with nulls always sorted last, regardless of direction. */
function compareDue(a: string | null, b: string | null, dir: 1 | -1) {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b) * dir
}

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
}

export default function MyWorkClient({
  currentPersonId,
  assigned,
  reported,
  engagementTasks,
  people,
  engagements,
}: {
  currentPersonId: string
  assigned: EngagementTaskWithRelations[]
  reported: EngagementTaskWithRelations[]
  engagementTasks: EngagementTaskWithRelations[]
  people: Named[]
  engagements: Named[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('assigned')
  const [statusFilter, setStatusFilter] = useState<EngagementTaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<EngagementTaskPriority | ''>('')
  const [sort, setSort] = useState<SortKey>('due_asc')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [showForm, setShowForm] = useState(false)

  const source = tab === 'assigned' ? assigned : tab === 'reported' ? reported : engagementTasks

  // A new task's reporter is always me; if I also self-assigned it, reveal the
  // tab where it actually lands so it never looks like the create silently failed.
  function handleCreated(task: EngagementTask) {
    setTab(task.assignee_person_id === currentPersonId ? 'assigned' : 'reported')
  }

  const rows = useMemo(() => {
    const filtered = source.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (dueFrom && (!t.due_date || t.due_date < dueFrom)) return false
      if (dueTo && (!t.due_date || t.due_date > dueTo)) return false
      return true
    })
    return filtered.sort((a, b) => {
      if (sort === 'created_desc') return b.created_at.localeCompare(a.created_at)
      if (sort === 'created_asc') return a.created_at.localeCompare(b.created_at)
      // Due-date sorts: nulls last, ties broken by priority desc.
      const due = compareDue(a.due_date, b.due_date, sort === 'due_desc' ? -1 : 1)
      if (due !== 0) return due
      return ENGAGEMENT_TASK_PRIORITY_RANK[b.priority] - ENGAGEMENT_TASK_PRIORITY_RANK[a.priority]
    })
  }, [source, statusFilter, priorityFilter, sort, dueFrom, dueTo])

  return (
    <div className="panel overflow-hidden">
      <div className="topbar">
        <span className="topbar-title">My work</span>
        <span className="topbar-count">{rows.length}</span>
        <div className="topbar-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New task</button>
        </div>
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <div className="filterbar">
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as EngagementTaskStatus | '')}>
          <option value="">All statuses</option>
          {ENGAGEMENT_TASK_STATUSES.map((s) => (<option key={s} value={s}>{ENGAGEMENT_TASK_STATUS_LABELS[s]}</option>))}
        </select>
        <select className="filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as EngagementTaskPriority | '')}>
          <option value="">All priorities</option>
          {(Object.keys(ENGAGEMENT_TASK_PRIORITY_LABELS) as EngagementTaskPriority[]).map((p) => (<option key={p} value={p}>{ENGAGEMENT_TASK_PRIORITY_LABELS[p]}</option>))}
        </select>
        <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
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

      <div style={{ padding: 24, paddingTop: 12 }}>
        {rows.length === 0 ? <div className="empty">No tasks.</div> : (
          <table className="data-table">
            <thead><tr><th>Title</th><th>Engagement</th><th>Status</th><th>Priority</th><th>Due</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/my-work/${t.id}?from=${encodeURIComponent('/my-work')}`)}>
                  <td className="td-name">{t.title}</td>
                  <td>{t.engagement?.name ?? '—'}</td>
                  <td><span className="channel-tag">{ENGAGEMENT_TASK_STATUS_LABELS[t.status]}</span></td>
                  <td>{ENGAGEMENT_TASK_PRIORITY_LABELS[t.priority]}</td>
                  <td className="td-mono">{fmtDate(t.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm ? (
        <TaskForm
          people={people}
          engagements={engagements}
          initialAssigneeId={currentPersonId}
          onCreated={handleCreated}
          onClose={() => setShowForm(false)}
        />
      ) : null}
    </div>
  )
}
