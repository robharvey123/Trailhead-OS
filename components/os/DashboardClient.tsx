'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDateTime, formatTaskDate, getWorkstreamColourClasses } from '@/lib/os'
import type {
  DashboardUpcomingItem,
  NoteWithWorkstream,
  TaskWithWorkstream,
  WorkstreamSummary,
} from '@/lib/types'
import PriorityBadge from './PriorityBadge'
import QuickAddTask from './QuickAddTask'
import WorkstreamBadge from './WorkstreamBadge'

function formatEventTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', {
    timeStyle: 'short',
  }).format(date)
}

interface DashboardClientProps {
  todaysTasks: TaskWithWorkstream[]
  upcomingItems: DashboardUpcomingItem[]
  workstreamSummaries: WorkstreamSummary[]
  recentNotes: NoteWithWorkstream[]
}

export default function DashboardClient({
  todaysTasks,
  upcomingItems,
  workstreamSummaries,
  recentNotes,
}: DashboardClientProps) {
  const router = useRouter()

  const groupedToday = todaysTasks.reduce<Record<string, TaskWithWorkstream[]>>((groups, task) => {
    const key = task.workstream_label ?? 'Master list'
    groups[key] = [...(groups[key] ?? []), task]
    return groups
  }, {})

  const groupedUpcoming = upcomingItems.reduce<Record<string, DashboardUpcomingItem[]>>((groups, item) => {
    const key = item.date
    groups[key] = [...(groups[key] ?? []), item]
    return groups
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Command centre</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-50">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Today&apos;s priorities, board momentum, and fresh notes across Trailhead OS.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr_0.95fr]">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Today&apos;s tasks</h2>
              <p className="text-sm text-slate-400">Due today plus anything pinned to the master list.</p>
            </div>
          </div>

          <QuickAddTask
            className="mt-5"
            placeholder="Quick add to the master list..."
            isMasterTodo
            onCreated={() => router.refresh()}
          />

          <div className="mt-6 space-y-5">
            {todaysTasks.length === 0 ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-700 px-4 py-10 text-center">
                <p className="text-base font-medium text-slate-200">No tasks in focus yet.</p>
                <p className="mt-2 text-sm text-slate-500">Add the first one above to get the board moving.</p>
              </div>
            ) : (
              Object.entries(groupedToday).map(([group, tasks]) => (
                <div key={group}>
                  <h3 className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">{group}</h3>
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-100">{task.title}</p>
                            <p className="mt-1 text-sm text-slate-400">{formatTaskDate(task.due_date)}</p>
                          </div>
                          <PriorityBadge priority={task.priority} />
                        </div>
                        {task.workstream_label ? (
                          <WorkstreamBadge
                            className="mt-3"
                            label={task.workstream_label}
                            slug={task.workstream_slug}
                            colour={task.workstream_colour}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Board activity</h2>
            <p className="text-sm text-slate-400">A quick read on what each workstream needs next.</p>
          </div>

          <div className="mt-6 space-y-4">
            {workstreamSummaries.map((summary) => {
              const classes = getWorkstreamColourClasses(summary.colour)
              return (
                <Link
                  key={summary.id}
                  href={`/projects/${summary.slug}`}
                  className={`block rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:border-slate-600 ${classes.card}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className={`h-3 w-3 rounded-full ${classes.dot}`} />
                        <h3 className="text-base font-semibold text-slate-100">{summary.label}</h3>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {summary.due_this_week_count} due this week
                      </p>
                    </div>
                    <p className="text-xs text-slate-500">
                      {summary.last_updated ? formatDateTime(summary.last_updated) : 'No activity yet'}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {summary.column_counts.map((column) => (
                      <div key={column.column_id} className="rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{column.label}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-100">{column.task_count}</p>
                      </div>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Upcoming</h2>
              <p className="text-sm text-slate-400">What&apos;s landing over the next week.</p>
            </div>

            <div className="mt-5 space-y-4">
              {upcomingItems.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
                  Nothing due in the next seven days.
                </p>
              ) : (
                Object.entries(groupedUpcoming).map(([date, items]) => (
                  <div key={date}>
                    <h3 className="mb-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                      {formatTaskDate(date)}
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => {
                        if (item.type === 'task') {
                          const task = item.data
                          return (
                            <div key={`task-${task.id}`} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-slate-100">{task.title}</p>
                                <PriorityBadge priority={task.priority} />
                              </div>
                              {task.workstream_label ? (
                                <WorkstreamBadge
                                  className="mt-3"
                                  label={task.workstream_label}
                                  slug={task.workstream_slug}
                                  colour={task.workstream_colour}
                                />
                              ) : null}
                            </div>
                          )
                        }

                        const event = item.data
                        const workstream = workstreamSummaries.find(
                          (summary) => summary.id === event.workstream_id
                        )

                        return (
                          <div
                            key={`event-${event.id}`}
                            className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4"
                            style={{ borderLeftColor: event.colour || '#3B82F6', borderLeftWidth: '4px' }}
                          >
                            <p className="text-sm font-medium text-slate-100">{event.title}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              {!event.all_day ? <span>{formatEventTime(event.start_at)}</span> : null}
                              {event.location ? <span>{event.location}</span> : null}
                            </div>
                            {workstream ? (
                              <WorkstreamBadge
                                className="mt-3"
                                label={workstream.label}
                                slug={workstream.slug}
                                colour={workstream.colour}
                              />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Recent notes</h2>
              <p className="text-sm text-slate-400">The last edits across all workstreams.</p>
            </div>

            <div className="mt-5 space-y-3">
              {recentNotes.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-500">
                  No notes yet.
                </p>
              ) : (
                recentNotes.map((note) => (
                  <article key={note.id} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                    {note.workstream_label ? (
                      <WorkstreamBadge
                        label={note.workstream_label}
                        slug={note.workstream_slug}
                        colour={note.workstream_colour}
                      />
                    ) : null}
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{note.body}</p>
                    <p className="mt-3 text-xs text-slate-500">{formatDateTime(note.updated_at)}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
