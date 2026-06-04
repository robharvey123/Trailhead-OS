'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import TaskForm from '@/components/tasks/TaskForm'
import {
  ENGAGEMENT_TASK_PRIORITY_LABELS,
  ENGAGEMENT_TASK_PRIORITY_RANK,
  ENGAGEMENT_TASK_STATUSES,
  ENGAGEMENT_TASK_STATUS_LABELS,
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

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
}

export default function MyWorkClient({
  assigned,
  reported,
  engagementTasks,
  people,
  engagements,
}: {
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
  const [showForm, setShowForm] = useState(false)

  const source = tab === 'assigned' ? assigned : tab === 'reported' ? reported : engagementTasks

  const rows = useMemo(() => {
    const filtered = source.filter(
      (t) => (!statusFilter || t.status === statusFilter) && (!priorityFilter || t.priority === priorityFilter)
    )
    // due_date asc nulls last, then priority desc.
    return filtered.sort((a, b) => {
      if (a.due_date !== b.due_date) {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      }
      return ENGAGEMENT_TASK_PRIORITY_RANK[b.priority] - ENGAGEMENT_TASK_PRIORITY_RANK[a.priority]
    })
  }, [source, statusFilter, priorityFilter])

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

      {showForm ? <TaskForm people={people} engagements={engagements} onClose={() => setShowForm(false)} /> : null}
    </div>
  )
}
