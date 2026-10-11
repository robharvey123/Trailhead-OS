import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  PROJECT_SELECT,
  getWorkstreamBySlug,
  jsonError,
  parseProjectStatus,
  parseLimit,
  todayDate,
} from '@/lib/cowork-api'
import { createCoworkProject } from '@/lib/cowork-projects'
import { supabaseService } from '@/lib/supabase/service'

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export async function GET(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const workstreamSlug = searchParams.get('workstream')
    const status = searchParams.get('status')
    const limit = parseLimit(searchParams.get('limit'), 20, 100)
    const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null

    let query = supabaseService
      .from('projects')
      .select(PROJECT_SELECT)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit)

    if (workstream) {
      query = query.eq('workstream_id', workstream.id)
    }

    if (status) {
      query = query.eq('status', parseProjectStatus(status, status))
    }

    const { data: projects, error } = await query

    if (error) {
      throw error
    }

    const projectIds = (projects ?? []).map((project) => String(project.id))

    if (projectIds.length === 0) {
      return Response.json([])
    }

    const [tasksResult, milestonesResult] = await Promise.all([
      supabaseService
        .from('tasks')
        .select('id, project_id, completed_at')
        .in('project_id', projectIds),
      supabaseService
        .from('project_milestones')
        .select('id, project_id, name, date, completed')
        .in('project_id', projectIds)
        .order('date', { ascending: true }),
    ])

    if (tasksResult.error) {
      throw tasksResult.error
    }

    if (milestonesResult.error) {
      throw milestonesResult.error
    }

    return Response.json(
      (projects ?? []).map((project) => {
        const projectTasks = (tasksResult.data ?? []).filter(
          (task) => String(task.project_id) === String(project.id)
        )
        const completedCount = projectTasks.filter((task) => Boolean(task.completed_at)).length
        const progress = projectTasks.length
          ? Math.round((completedCount / projectTasks.length) * 100)
          : 0
        const nextMilestone =
          (milestonesResult.data ?? []).find(
            (milestone) =>
              String(milestone.project_id) === String(project.id) &&
              milestone.completed === false &&
              milestone.date >= todayDate()
          ) ?? null
        const workstreamRelation = firstRelation(project.workstreams)
        const accountRelation = firstRelation(project.accounts)

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          workstream: workstreamRelation
            ? {
                slug: workstreamRelation.slug,
                label: workstreamRelation.label,
              }
            : null,
          account_name: accountRelation?.name ?? null,
          progress,
          start_date: project.start_date,
          end_date: project.end_date,
          ai_planned: project.ai_planned,
          task_count: projectTasks.length,
          next_milestone: nextMilestone
            ? { name: nextMilestone.name, date: nextMilestone.date }
            : null,
        }
      })
    )
  } catch (error) {
    return jsonError(error, 'Failed to load projects')
  }
}

export async function POST(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return Response.json({ error: 'Unauthorised' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    return Response.json(await createCoworkProject(body))
  } catch (error) {
    return jsonError(error, 'Failed to create project')
  }
}
