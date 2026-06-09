import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile, roleIsAdmin } from '@/lib/auth/roles'
import { getEngagementTask, listTaskComments, listTaskActivity } from '@/lib/db/engagement-tasks'
import { getRunningTimer, getTaskTimeSummary, listTaskTimeEntries } from '@/lib/db/timesheet'
import { listPeople } from '@/lib/db/people'
import { markRead } from '../actions'
import { mockupFontVars } from '@/lib/fonts'
import CommentThread from '@/components/tasks/CommentThread'
import TaskDetailControls from '@/components/tasks/TaskDetailControls'
import TaskTitleEditor from '@/components/tasks/TaskTitleEditor'
import TaskDescriptionEditor from '@/components/tasks/TaskDescriptionEditor'
import TaskTimer from '@/components/tasks/TaskTimer'
import TaskTimeLog from '@/components/tasks/TaskTimeLog'
import TaskStatusBadge from '@/components/tasks/TaskStatusBadge'
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
    case 'priority_changed': return `set priority to ${ENGAGEMENT_TASK_PRIORITY_LABELS[(p.to as keyof typeof ENGAGEMENT_TASK_PRIORITY_LABELS)] ?? p.to}`
    case 'title_changed': return 'renamed the task'
    case 'description_changed': return 'updated the description'
    case 'labels_changed': return 'updated the labels'
    case 'commented': return 'commented'
    default: return a.kind
  }
}

/** A board route gets "Back to board"; anything else (e.g. a project detail) gets "Back". */
function looksLikeBoard(path: string): boolean {
  return path === '/my-work' || path.endsWith('/tasks')
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const supabase = await createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) redirect('/login')

  const task = await getEngagementTask(id, supabase).catch(() => null)
  if (!task) notFound()

  // Where "Back" goes. Trust ?from only if it's an in-app absolute path (no
  // open-redirect). Otherwise best-guess: admins live on engagement boards,
  // everyone else on their personal board.
  const safeFrom = from && from.startsWith('/') ? from : null
  const backHref =
    safeFrom ??
    (roleIsAdmin(profile.role) && task.engagement_id ? `/engagements/${task.engagement_id}/tasks` : '/my-work')
  const backLabel = !safeFrom || looksLikeBoard(safeFrom) ? '← Back to board' : '← Back'

  const [comments, activity, people, runningTimer, timeSummary, timeEntries] = await Promise.all([
    listTaskComments(id, supabase).catch(() => []),
    listTaskActivity(id, supabase).catch(() => []),
    listPeople({ activeOnly: true }, supabase).catch(() => []),
    getRunningTimer(supabase).catch(() => null),
    getTaskTimeSummary(id, supabase).catch(() => ({ totalMinutes: 0, billableMinutes: 0, people: [] })),
    listTaskTimeEntries(id, supabase).catch(() => []),
  ])

  // Default billable for the Log-time modal follows the engagement type.
  let defaultBillable = true
  if (task.engagement_id) {
    const { data: eng } = await supabase.from('engagements').select('is_billable').eq('id', task.engagement_id).maybeSingle()
    defaultBillable = eng?.is_billable ?? true
  }

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
          <Link href={backHref} className="td-mono" style={{ textDecoration: 'none', color: 'var(--text-3)' }}>{backLabel}</Link>
          {canEdit ? <TaskTitleEditor taskId={task.id} title={task.title} /> : <span className="topbar-title">{task.title}</span>}
          <TaskStatusBadge status={task.status} />
        </div>

        <div style={{ padding: 24, display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
          <div style={{ display: 'grid', gap: 16 }}>
            {canEdit ? (
              <TaskDetailControls
                taskId={task.id}
                status={task.status}
                position={task.position}
                assigneePersonId={task.assignee_person_id}
                priority={task.priority}
                dueDate={task.due_date}
                labels={task.labels}
                people={people.map((p) => ({ id: p.id, name: p.full_name }))}
              />
            ) : null}

            <div className="card">
              <div className="panel-section-title">Description</div>
              {canEdit ? (
                <TaskDescriptionEditor taskId={task.id} description={task.description} />
              ) : (
                <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: 0, color: task.description ? 'var(--text)' : 'var(--text-3)' }}>{task.description || 'No description.'}</p>
              )}
            </div>

            <div className="card">
              <div className="panel-section-title">Time logged</div>
              <TaskTimeLog
                taskId={task.id}
                defaultBillable={defaultBillable}
                canLog={!!profile.person_id}
                summary={timeSummary}
                entries={timeEntries}
              />
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
                <dt className="field-label">Reporter</dt><dd>{task.reporter?.full_name ?? '—'}</dd>
                <dt className="field-label">Completed</dt><dd className="td-mono">{fmtDate(task.completed_at)}</dd>
                {/* Priority/Assignee/Due/Labels are editable above for editors; show read-only here only for viewers. */}
                {!canEdit ? (
                  <>
                    <dt className="field-label">Priority</dt><dd>{ENGAGEMENT_TASK_PRIORITY_LABELS[task.priority]}</dd>
                    <dt className="field-label">Assignee</dt><dd>{task.assignee?.full_name ?? '—'}</dd>
                    <dt className="field-label">Due</dt><dd className="td-mono">{fmtDate(task.due_date)}</dd>
                    {task.labels.length ? <><dt className="field-label">Labels</dt><dd>{task.labels.join(', ')}</dd></> : null}
                  </>
                ) : null}
              </dl>
            </div>

            <div className="card">
              <div className="panel-section-title">Time</div>
              <TaskTimer
                taskId={task.id}
                projectId={task.project_id ?? null}
                engagementId={task.engagement_id ?? null}
                initialRunning={runningTimer}
                loggedMinutes={timeSummary.totalMinutes}
              />
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
