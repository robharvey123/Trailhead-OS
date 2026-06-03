import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { getEngagementTask, listTaskComments, listTaskActivity } from '@/lib/db/engagement-tasks'
import { listPeople } from '@/lib/db/people'
import { markRead } from '../actions'
import { mockupFontVars } from '@/lib/fonts'
import CommentThread from '@/components/tasks/CommentThread'
import TaskDetailControls from '@/components/tasks/TaskDetailControls'
import {
  ENGAGEMENT_TASK_PRIORITY_LABELS,
  ENGAGEMENT_TASK_STATUS_LABELS,
  type EngagementTaskActivity,
} from '@/lib/types'

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
}
function fmtAt(v: string) {
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function activityText(a: EngagementTaskActivity): string {
  const p = a.payload || {}
  switch (a.kind) {
    case 'created': return 'created this task'
    case 'status_changed': return `moved ${ENGAGEMENT_TASK_STATUS_LABELS[(p.from as keyof typeof ENGAGEMENT_TASK_STATUS_LABELS) ] ?? p.from} → ${ENGAGEMENT_TASK_STATUS_LABELS[(p.to as keyof typeof ENGAGEMENT_TASK_STATUS_LABELS)] ?? p.to}`
    case 'assigned': return p.to ? 'changed the assignee' : 'unassigned this task'
    case 'due_date_changed': return `changed the due date to ${p.to ? fmtDate(String(p.to)) : 'none'}`
    case 'commented': return 'commented'
    default: return a.kind
  }
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  const task = await getEngagementTask(id, supabase).catch(() => null)
  if (!task) notFound()

  const [comments, activity, people] = await Promise.all([
    listTaskComments(id, supabase).catch(() => []),
    listTaskActivity(id, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
  ])

  // Opening the detail clears the unread cursor for this person.
  if (profile.person_id) await markRead(id).catch(() => {})

  const canEdit =
    roleIsAdmin(profile.role) ||
    task.assignee_person_id === profile.person_id ||
    task.reporter_person_id === profile.person_id

  return (
    <div className={`thmock ${mockupFontVars}`}>
      <div className="panel overflow-hidden">
        <div className="topbar">
          <Link href="/my-work" className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>‹ My work</Link>
          <span className="topbar-title">{task.title}</span>
          <span className="channel-tag">{ENGAGEMENT_TASK_STATUS_LABELS[task.status]}</span>
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {canEdit ? (
              <TaskDetailControls taskId={task.id} status={task.status} position={task.position} assigneePersonId={task.assignee_person_id} people={people.map((p) => ({ id: p.id, name: p.full_name }))} />
            ) : null}

            <div className="card">
              <div className="panel-section-title">Description</div>
              <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0, color: task.description ? 'var(--text)' : 'var(--text-3)' }}>{task.description || 'No description.'}</p>
            </div>

            <div className="card">
              <div className="panel-section-title">Comments</div>
              <CommentThread taskId={task.id} comments={comments} canComment={!!profile.person_id} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <div className="card">
              <div className="panel-section-title">Details</div>
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13, margin: 0 }}>
                <dt className="field-label">Engagement</dt><dd>{task.engagement ? <Link href={`/engagements/${task.engagement.id}/tasks`}>{task.engagement.name}</Link> : '—'}</dd>
                <dt className="field-label">Priority</dt><dd>{ENGAGEMENT_TASK_PRIORITY_LABELS[task.priority]}</dd>
                <dt className="field-label">Assignee</dt><dd>{task.assignee?.full_name ?? '—'}</dd>
                <dt className="field-label">Reporter</dt><dd>{task.reporter?.full_name ?? '—'}</dd>
                <dt className="field-label">Due</dt><dd className="td-mono">{fmtDate(task.due_date)}</dd>
                <dt className="field-label">Completed</dt><dd className="td-mono">{fmtDate(task.completed_at)}</dd>
                {task.labels.length ? <><dt className="field-label">Labels</dt><dd>{task.labels.join(', ')}</dd></> : null}
              </dl>
            </div>

            <div className="card">
              <div className="panel-section-title">Activity</div>
              {activity.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No activity.</p> : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
                  {activity.map((a) => (
                    <li key={a.id} style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      <span>{activityText(a)}</span>
                      <span className="td-mono" style={{ color: 'var(--text-3)', marginLeft: 6 }}>{fmtAt(a.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
