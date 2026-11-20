import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError } from '@/lib/cowork-api'
import { deleteCoworkTask, getCoworkTask, updateCoworkTask } from '@/lib/cowork-tasks'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const { id } = await params
    return Response.json(await getCoworkTask(id))
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
    const existing = await deleteCoworkTask(id)

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
