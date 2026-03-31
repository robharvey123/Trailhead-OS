import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateTask, deleteTask } from '@/lib/db/tasks'

function labelize(value: string | null | undefined) {
  if (!value) {
    return 'None'
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function dateLabel(value: string | null | undefined) {
  if (!value) {
    return 'None'
  }

  return value
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  try {
    const { data: existingTask, error: existingTaskError } = await supabase
      .from('tasks')
      .select('id, title, status, priority, owner, start_date, due_date, estimated_hours, actual_hours')
      .eq('id', id)
      .single()

    if (existingTaskError) {
      throw new Error(existingTaskError.message || 'Failed to load task before update')
    }

    const task = await updateTask(id, body, supabase)

    const activityEntries: Array<{
      task_id: string
      type: 'status_change' | 'priority_change' | 'assignment' | 'field_update'
      content: string
      created_by: string
    }> = []

    const actor = user.email ?? user.id

    if (existingTask.status !== task.status) {
      activityEntries.push({
        task_id: id,
        type: 'status_change',
        content: `Status changed from ${labelize(existingTask.status)} to ${labelize(task.status)}`,
        created_by: actor,
      })
    }

    if (existingTask.priority !== task.priority) {
      activityEntries.push({
        task_id: id,
        type: 'priority_change',
        content: `Priority changed from ${labelize(existingTask.priority)} to ${labelize(task.priority)}`,
        created_by: actor,
      })
    }

    if (existingTask.owner !== task.owner) {
      activityEntries.push({
        task_id: id,
        type: 'assignment',
        content: task.owner ? `Assigned to ${task.owner}` : 'Assignment cleared',
        created_by: actor,
      })
    }

    if (existingTask.start_date !== task.start_date) {
      activityEntries.push({
        task_id: id,
        type: 'field_update',
        content: `Start date changed from ${dateLabel(existingTask.start_date)} to ${dateLabel(task.start_date)}`,
        created_by: actor,
      })
    }

    if (existingTask.due_date !== task.due_date) {
      activityEntries.push({
        task_id: id,
        type: 'field_update',
        content: `Due date changed from ${dateLabel(existingTask.due_date)} to ${dateLabel(task.due_date)}`,
        created_by: actor,
      })
    }

    if (existingTask.estimated_hours !== task.estimated_hours) {
      activityEntries.push({
        task_id: id,
        type: 'field_update',
        content: `Estimated hours changed from ${existingTask.estimated_hours ?? 0} to ${task.estimated_hours ?? 0}`,
        created_by: actor,
      })
    }

    if (existingTask.actual_hours !== task.actual_hours) {
      activityEntries.push({
        task_id: id,
        type: 'field_update',
        content: `Actual hours changed from ${existingTask.actual_hours ?? 0} to ${task.actual_hours ?? 0}`,
        created_by: actor,
      })
    }

    if (activityEntries.length > 0) {
      const { error: activityError } = await supabase.from('task_activity').insert(activityEntries)
      if (activityError) {
        throw new Error(activityError.message || 'Failed to log task activity')
      }
    }

    return NextResponse.json({ task })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const hardDelete = request.nextUrl.searchParams.get('hard') === 'true'

  try {
    await deleteTask(id, { hardDelete }, supabase)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete task'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
