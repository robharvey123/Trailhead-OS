import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { jsonError, parseBooleanParam, parseLimit, parseTaskDueFilter } from '@/lib/cowork-api'
import { createCoworkTask, listCoworkTasks, parseTaskPriority, parseTaskStatus } from '@/lib/cowork-tasks'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const priorityParam = searchParams.get('priority')
    const statusParam = searchParams.get('status')

    const tasks = await listCoworkTasks({
      projectId: searchParams.get('project_id'),
      engagementId: searchParams.get('engagement_id') ?? searchParams.get('engagement'),
      priority: priorityParam ? parseTaskPriority(priorityParam) : null,
      status: statusParam ? parseTaskStatus(statusParam) : null,
      due: parseTaskDueFilter(searchParams.get('due')),
      includeClosed: parseBooleanParam(searchParams.get('include_closed')) === true,
      limit: parseLimit(searchParams.get('limit'), 50, 200),
    })

    return Response.json(tasks)
  } catch (error) {
    return jsonError(error, 'Failed to load tasks')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const task = await createCoworkTask(body)
    void recordCoworkWrite({
      action: 'create',
      entity: 'task',
      entityId: task.id,
      entityLabel: task.title,
      summary: `Created task "${task.title}"${task.project ? ` in ${task.project.name}` : ''}`,
      payload: body,
    })
    return Response.json(task, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create task')
  }
}
