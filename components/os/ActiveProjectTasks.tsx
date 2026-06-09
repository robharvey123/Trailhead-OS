import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  listOpenEngagementTasksOnActiveProjects,
  type ActiveProjectTaskRow,
} from '@/lib/db/engagement-tasks'
import {
  ENGAGEMENT_TASK_PRIORITY_LABELS,
  ENGAGEMENT_TASK_PRIORITY_RANK,
  type EngagementTaskPriority,
} from '@/lib/types'
import TaskStatusBadge from '@/components/tasks/TaskStatusBadge'

const VISIBLE_CAP = 10

function todayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDue(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00`)
  )
}

/** due asc (nulls last), then priority desc, then position asc — within a project group. */
function sortWithinProject(a: ActiveProjectTaskRow, b: ActiveProjectTaskRow) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  }
  const rank = ENGAGEMENT_TASK_PRIORITY_RANK[b.priority] - ENGAGEMENT_TASK_PRIORITY_RANK[a.priority]
  if (rank !== 0) return rank
  return a.position - b.position
}

function priorityClasses(priority: EngagementTaskPriority) {
  if (priority === 'urgent') {
    return 'border-[color:var(--red)] text-[color:var(--red-strong)]'
  }
  if (priority === 'high') {
    return 'border-[color:var(--amber)] text-[color:var(--amber-strong)]'
  }
  return 'border-[color:var(--border)] text-[color:var(--text-3)]'
}

export default async function ActiveProjectTasks() {
  const supabase = await createClient()
  const tasks = await listOpenEngagementTasksOnActiveProjects(supabase).catch(() => [])

  // Group by project, ordered by project name.
  const groups = new Map<string, { name: string; tasks: ActiveProjectTaskRow[] }>()
  for (const task of tasks) {
    const group = groups.get(task.project_id)
    if (group) {
      group.tasks.push(task)
    } else {
      groups.set(task.project_id, { name: task.project_name, tasks: [task] })
    }
  }
  const orderedGroups = [...groups.values()]
    .map((group) => ({ ...group, tasks: group.tasks.sort(sortWithinProject) }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Cap total visible task rows across all groups at ~10.
  const visibleGroups: { name: string; tasks: ActiveProjectTaskRow[] }[] = []
  let shown = 0
  for (const group of orderedGroups) {
    if (shown >= VISIBLE_CAP) break
    const slice = group.tasks.slice(0, VISIBLE_CAP - shown)
    shown += slice.length
    visibleGroups.push({ name: group.name, tasks: slice })
  }

  const today = todayKey()

  return (
    <section className="os-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="os-eyebrow text-[color:var(--accent-strong)]">Active projects</p>
          <h2 className="os-section-title">Open tasks</h2>
        </div>
        <Link
          href="/tasks"
          className="text-sm font-medium text-[color:var(--text-2)] transition hover:text-[color:var(--text)]"
        >
          View all →
        </Link>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--text-3)]">No open tasks on active projects</p>
      ) : (
        <div className="mt-4 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.name}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-3)]">
                {group.name}
              </p>
              <ul className="mt-2 space-y-2">
                {group.tasks.map((task) => {
                  const overdue = Boolean(task.due_date) && task.due_date! < today
                  return (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-2)] px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text)]">
                        {task.title}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs">
                        <TaskStatusBadge status={task.status} />
                        <span
                          className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-[0.14em] ${priorityClasses(task.priority)}`}
                        >
                          {ENGAGEMENT_TASK_PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.due_date ? (
                          <span
                            className={
                              overdue
                                ? 'font-semibold text-[color:var(--red-strong)]'
                                : 'text-[color:var(--text-3)]'
                            }
                          >
                            {formatDue(task.due_date)}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
