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

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
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
    return Response.json(task, { status: 201 })
  } catch (error) {
    return jsonError(error, 'Failed to create task')
  }
}
