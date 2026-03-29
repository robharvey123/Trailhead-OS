import { NextRequest, NextResponse } from 'next/server'
import {
  getColumnIdForWorkstream,
  getTaskById,
  jsonError,
  mapTask,
  optionalDate,
  optionalIsoDatetime,
  optionalString,
  parseColumnKey,
  parsePriority,
  requireCoworkAuth,
} from '@/lib/cowork-api'
import { supabaseService } from '@/lib/supabase/service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorised = requireCoworkAuth(request)
  if (unauthorised) {
    return unauthorised
  }

  try {
    const { id } = await params
    const existingTask = await getTaskById(id)
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = optionalString(body.title)
      if (!title) {
        return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 })
      }
      patch.title = title
    }

    if (body.priority !== undefined) {
      patch.priority = parsePriority(body.priority)
    }

    if (body.due_date !== undefined) {
      patch.due_date = optionalDate(body.due_date, 'due_date')
    }

    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') {
        return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 })
      }
      patch.description = optionalString(body.description)
    }

    if (body.completed_at !== undefined) {
      patch.completed_at = optionalIsoDatetime(body.completed_at, 'completed_at')
    }

    if (body.is_master_todo !== undefined) {
      if (typeof body.is_master_todo !== 'boolean') {
        return NextResponse.json({ error: 'is_master_todo must be a boolean' }, { status: 400 })
      }
      patch.is_master_todo = body.is_master_todo
    }

    if (body.column !== undefined) {
      if (!existingTask.workstream_id) {
        return NextResponse.json({ error: 'Cannot move a task without a workstream' }, { status: 400 })
      }
      patch.column_id = await getColumnIdForWorkstream(existingTask.workstream_id, parseColumnKey(body.column))
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select('id, workstream_id, column_id, contact_id, title, description, priority, due_date, is_master_todo, tags, sort_order, completed_at, created_at, updated_at, workstreams(slug, label, colour)')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json(mapTask(data))
  } catch (error) {
    return jsonError(error, 'Failed to update task')
  }
}
