import DashboardClient from '@/components/os/DashboardClient'
import { getCalendarEvents } from '@/lib/db/calendar-events'
import { getColumnsByWorkstream } from '@/lib/db/columns'
import { getRecentNotes } from '@/lib/db/notes'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { DashboardUpcomingItem, WorkstreamSummary } from '@/lib/types'

function formatDate(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLabel = formatDate(today)
  const weekAhead = new Date(today)
  weekAhead.setDate(weekAhead.getDate() + 7)
  weekAhead.setHours(23, 59, 59, 999)
  const weekAheadIso = weekAhead.toISOString()
  const todayIso = today.toISOString()

  const [workstreams, dueToday, masterTodos, upcomingTasks, upcomingEvents, recentNotes] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getTasks({ due_date_from: todayLabel, due_date_to: todayLabel }, supabase).catch(() => []),
    getTasks({ is_master_todo: true }, supabase).catch(() => []),
    getTasks({ due_date_from: todayLabel, due_date_to: formatDate(weekAhead) }, supabase).catch(() => []),
    getCalendarEvents({ start_at_gte: todayIso, start_at_lte: weekAheadIso }, supabase).catch(() => []),
    getRecentNotes(3, supabase).catch(() => []),
  ])

  const todayIds = new Set<string>()
  const todaysTasks = [...dueToday, ...masterTodos].filter((task) => {
    if (todayIds.has(task.id)) {
      return false
    }
    todayIds.add(task.id)
    return true
  })

  const upcomingItems: DashboardUpcomingItem[] = [
    ...upcomingTasks
      .filter((task) => task.due_date)
      .map((task) => ({
        type: 'task' as const,
        date: task.due_date!,
        sort_at: `${task.due_date}T${task.due_time ?? '00:00:00'}`,
        data: task,
      })),
    ...upcomingEvents.map((event) => ({
      type: 'event' as const,
      date: formatDate(new Date(event.start_at)),
      sort_at: event.start_at,
      data: event,
    })),
  ].sort((left, right) => new Date(left.sort_at).getTime() - new Date(right.sort_at).getTime())

  const workstreamSummaries: WorkstreamSummary[] = await Promise.all(
    workstreams.map(async (workstream) => {
      const [columns, tasks, dueThisWeek] = await Promise.all([
        getColumnsByWorkstream(workstream.id, supabase).catch(() => []),
        getTasks({ workstream_id: workstream.id, include_completed: true }, supabase).catch(() => []),
        getTasks(
          {
            workstream_id: workstream.id,
            due_date_from: todayLabel,
            due_date_to: formatDate(weekAhead),
          },
          supabase
        ).catch(() => []),
      ])

      const lastUpdated = tasks
        .map((task) => task.updated_at)
        .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

      return {
        ...workstream,
        column_counts: columns.map((column) => ({
          column_id: column.id,
          label: column.label,
          task_count: tasks.filter((task) => task.column_id === column.id && !task.completed_at).length,
        })),
        due_this_week_count: dueThisWeek.length,
        last_updated: lastUpdated,
      }
    })
  )

  return (
    <DashboardClient
      todaysTasks={todaysTasks}
      upcomingItems={upcomingItems}
      workstreamSummaries={workstreamSummaries}
      recentNotes={recentNotes}
    />
  )
}
