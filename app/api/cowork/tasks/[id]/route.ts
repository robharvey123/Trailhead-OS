import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { formatTask, getTaskById, jsonError } from '@/lib/cowork-api'
import { updateCoworkTask } from '@/lib/cowork-tasks'
import { recordCoworkWrite } from '@/lib/cowork-audit'
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
    const body = await request.json().catch(() => ({}))
    const task = await updateCoworkTask(id, body)
    void recordCoworkWrite({
      action: 'update',
      entity: 'task',
      entityId: task.id,
      entityLabel: task.title,
      summary: `Updated task "${task.title}" (${Object.keys(body).join(', ')})`,
      payload: body,
    })
    return Response.json(task)
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
    const existing = await getTaskById(id)

    const { error } = await supabaseService
      .from('tasks')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    void recordCoworkWrite({
      action: 'delete',
      entity: 'task',
      entityId: id,
      entityLabel: existing.title,
      summary: `Deleted task "${existing.title}"`,
    })
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete task')
  }
}
