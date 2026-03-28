import DashboardClient from '@/components/os/DashboardClient'
import { getColumnsByWorkstream } from '@/lib/db/columns'
import { getRecentNotes } from '@/lib/db/notes'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import { createClient } from '@/lib/supabase/server'
import type { WorkstreamSummary } from '@/lib/types'

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date()
  const todayLabel = formatDate(today)
  const weekAhead = new Date(today)
  weekAhead.setDate(weekAhead.getDate() + 7)

  const [workstreams, dueToday, masterTodos, upcomingTasks, recentNotes] = await Promise.all([
    getWorkstreams(supabase).catch(() => []),
    getTasks({ due_date_from: todayLabel, due_date_to: todayLabel }, supabase).catch(() => []),
    getTasks({ is_master_todo: true }, supabase).catch(() => []),
    getTasks({ due_date_from: todayLabel, due_date_to: formatDate(weekAhead) }, supabase).catch(() => []),
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

  const upcoming = upcomingTasks.filter((task) => task.due_date !== todayLabel)

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
      upcomingTasks={upcoming}
      workstreamSummaries={workstreamSummaries}
      recentNotes={recentNotes}
    />
  )
}
