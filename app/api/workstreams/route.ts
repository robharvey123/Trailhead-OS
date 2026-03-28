import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { getColumnsByWorkstream } from '@/lib/db/columns'
import { getTasks } from '@/lib/db/tasks'
import { getWorkstreams } from '@/lib/db/workstreams'
import type { WorkstreamSummary } from '@/lib/types'

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = await createSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const workstreams = await getWorkstreams(supabase)
    const now = new Date()
    const weekAhead = new Date(now)
    weekAhead.setDate(weekAhead.getDate() + 7)

    const summaries = await Promise.all(
      workstreams.map(async (workstream): Promise<WorkstreamSummary> => {
        const [columns, tasks, dueThisWeek] = await Promise.all([
          getColumnsByWorkstream(workstream.id, supabase),
          getTasks({ workstream_id: workstream.id, include_completed: true }, supabase),
          getTasks(
            {
              workstream_id: workstream.id,
              due_date_from: formatDate(now),
              due_date_to: formatDate(weekAhead),
            },
            supabase
          ),
        ])

        const columnCounts = columns.map((column) => ({
          column_id: column.id,
          label: column.label,
          task_count: tasks.filter((task) => task.column_id === column.id && !task.completed_at).length,
        }))

        const lastUpdated = tasks
          .map((task) => task.updated_at)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null

        return {
          ...workstream,
          column_counts: columnCounts,
          due_this_week_count: dueThisWeek.length,
          last_updated: lastUpdated,
        }
      })
    )

    return NextResponse.json({ workstreams: summaries })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load workstreams' },
      { status: 500 }
    )
  }
}
