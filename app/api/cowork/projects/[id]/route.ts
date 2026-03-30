import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  PROJECT_SELECT,
  TASK_SELECT,
  formatTask,
  getProjectById,
  jsonError,
  optionalDate,
  optionalString,
  parseProjectStatus,
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
    const project = await getProjectById(id)

    const [phasesResult, milestonesResult, tasksResult] = await Promise.all([
      supabaseService
        .from('project_phases')
        .select('id, name, description, sort_order, start_date, end_date')
        .eq('project_id', id)
        .order('sort_order', { ascending: true }),
      supabaseService
        .from('project_milestones')
        .select('id, name, description, date, completed')
        .eq('project_id', id)
        .order('date', { ascending: true }),
      supabaseService
        .from('tasks')
        .select(TASK_SELECT)
        .eq('project_id', id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    ])

    if (phasesResult.error) {
      throw phasesResult.error
    }

    if (milestonesResult.error) {
      throw milestonesResult.error
    }

    if (tasksResult.error) {
      throw tasksResult.error
    }

    const tasks = tasksResult.data ?? []
    const completedCount = tasks.filter((task) => Boolean(task.completed_at)).length
    const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0
    const upcomingTasks = tasks
      .filter((task) => task.due_date && !task.completed_at)
      .slice(0, 5)
      .map((task) => formatTask(task as never))

    const phases = await Promise.all(
      (phasesResult.data ?? []).map(async (phase) => {
        const { count, error } = await supabaseService
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('phase_id', phase.id)

        if (error) {
          throw error
        }

        return {
          ...phase,
          task_count: count ?? 0,
        }
      })
    )

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(
      /\/$/,
      ''
    )

    return Response.json({
      id: project.id,
      name: project.name,
      description: project.description,
      brief: project.brief,
      status: project.status,
      start_date: project.start_date,
      end_date: project.end_date,
      estimated_end_date: project.estimated_end_date,
      ai_planned: project.ai_planned,
      workstream:
        project.workstreams && !Array.isArray(project.workstreams)
          ? {
              slug: project.workstreams.slug,
              label: project.workstreams.label,
            }
          : Array.isArray(project.workstreams) && project.workstreams[0]
            ? {
                slug: project.workstreams[0].slug,
                label: project.workstreams[0].label,
              }
            : null,
      account:
        project.accounts && !Array.isArray(project.accounts)
          ? { id: project.accounts.id, name: project.accounts.name }
          : Array.isArray(project.accounts) && project.accounts[0]
            ? { id: project.accounts[0].id, name: project.accounts[0].name }
            : null,
      phases,
      milestones: milestonesResult.data ?? [],
      upcoming_tasks: upcomingTasks,
      progress,
      links: {
        project: `${baseUrl}/projects/${project.id}`,
        tasks: `${baseUrl}/tasks?project_id=${project.id}`,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to load project')
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
    await getProjectById(id)

    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = optionalString(body.name)
      if (!name) {
        return Response.json({ error: 'name is required' }, { status: 400 })
      }
      patch.name = name
    }

    if (body.status !== undefined) patch.status = parseProjectStatus(body.status)
    if (body.description !== undefined) patch.description = optionalString(body.description)
    if (body.start_date !== undefined) patch.start_date = optionalDate(body.start_date, 'start_date')
    if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, 'end_date')

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const { data, error } = await supabaseService
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select(PROJECT_SELECT)
      .single()

    if (error) {
      throw error
    }

    return Response.json(data)
  } catch (error) {
    return jsonError(error, 'Failed to update project')
  }
}
