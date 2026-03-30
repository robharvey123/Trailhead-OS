import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  TASK_SELECT,
  formatTask,
  getColumnIdForWorkstream,
  getTaskById,
  jsonError,
  optionalDate,
  optionalIsoDatetime,
  optionalString,
  parseColumnKey,
  parsePriority,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const task = await getTaskById(id)
    return Response.json(formatTask(task))
  } catch (error) {
    return jsonError(error, 'Failed to load task')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    const existingTask = await getTaskById(id)
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = optionalString(body.title)
      if (!title) {
        return Response.json({ error: 'title must be a non-empty string' }, { status: 400 })
      }
      patch.title = title
    }

    if (body.description !== undefined) {
      patch.description = optionalString(body.description)
    }

    if (body.priority !== undefined) {
      patch.priority = parsePriority(body.priority)
    }

    if (body.due_date !== undefined) {
      patch.due_date = optionalDate(body.due_date, 'due_date')
    }

    if (body.start_date !== undefined) {
      patch.start_date = optionalDate(body.start_date, 'start_date')
    }

    if (body.is_master_todo !== undefined) {
      if (typeof body.is_master_todo !== 'boolean') {
        return Response.json({ error: 'is_master_todo must be a boolean' }, { status: 400 })
      }
      patch.is_master_todo = body.is_master_todo
    }

    if (body.completed_at !== undefined) {
      patch.completed_at = optionalIsoDatetime(body.completed_at, 'completed_at')
    }

    if (body.column !== undefined) {
      if (!existingTask.workstream_id) {
        return Response.json({ error: 'Task has no workstream to move within' }, { status: 400 })
      }

      patch.column_id = await getColumnIdForWorkstream(
        existingTask.workstream_id,
        parseColumnKey(body.column)
      )
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select(TASK_SELECT)
      .single()

    if (error) {
      throw error
    }

    return Response.json(formatTask(data as never))
  } catch (error) {
    return jsonError(error, 'Failed to update task')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    await getTaskById(id)

    const { error } = await supabaseService
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete task')
  }
}
