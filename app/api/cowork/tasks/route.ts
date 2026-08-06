import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  jsonError,
  parseBooleanParam,
  parseLimit,
  parsePriority,
  parseTaskDueFilter,
} from '@/lib/cowork-api'
import { createCoworkTask, listCoworkTasks } from '@/lib/cowork-tasks'
import { recordCoworkWrite } from '@/lib/cowork-audit'

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    // This lists the workstream KANBAN `tasks`, which are not engagement-scoped.
    // Reject engagement_id rather than silently returning every task — the counts
    // can coincide (49 kanban == 49 engagement tickets) and look filtered when they
    // aren't. Engagement tickets are their own table; use the engagement detail.
    if (searchParams.get('engagement_id') || searchParams.get('engagement')) {
      return Response.json(
        { error: 'engagement_id is not supported here — /api/cowork/tasks lists workstream kanban tasks, not engagement tickets.' },
        { status: 400 }
      )
    }
    const priorityParam = searchParams.get('priority')

    const tasks = await listCoworkTasks({
      workstreamSlug: searchParams.get('workstream'),
      projectId: searchParams.get('project_id'),
      priority: priorityParam ? parsePriority(priorityParam) : null,
      due: parseTaskDueFilter(searchParams.get('due')),
      master: parseBooleanParam(searchParams.get('master')) === true,
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
      summary: `Created task "${task.title}"${task.workstream ? ` in ${task.workstream.label}` : ''}`,
      payload: body,
    })
    return Response.json(task, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create task')
  }
}
