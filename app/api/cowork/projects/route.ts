import { NextRequest } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import {
  PROJECT_SELECT,
  getWorkstreamBySlug,
  jsonError,
  optionalDate,
  optionalString,
  parseProjectStatus,
  parseLimit,
  requiredString,
  todayDate,
} from '@/lib/cowork-api'
import { planProjectFromBrief } from '@/lib/project-planner'
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
    const name = requiredString(body.name, 'name')
    const workstream = await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))
    const brief = requiredString(body.brief, 'brief')
    const startDate = optionalDate(body.start_date, 'start_date') ?? todayDate()
    const tierSlug = optionalString(body.tier) ?? 'budget'
    const accountName = optionalString(body.account_name)

    const { data: pricingTier, error: tierError } = await supabaseService
      .from('pricing_tiers')
      .select('id')
      .eq('slug', tierSlug)
      .maybeSingle()

    if (tierError) {
      throw tierError
    }

    if (!pricingTier) {
      return Response.json({ error: `Pricing tier not found: ${tierSlug}` }, { status: 400 })
    }

    let accountId: string | null = null
    if (accountName) {
      const { data: account, error: accountError } = await supabaseService
        .from('accounts')
        .select('id')
        .ilike('name', accountName)
        .limit(1)
        .maybeSingle()

      if (accountError) {
        throw accountError
      }

      if (!account) {
        return Response.json({ error: `Account not found: ${accountName}` }, { status: 400 })
      }

      accountId = account.id
    }

    const { data: project, error } = await supabaseService
      .from('projects')
      .insert({
        name,
        workstream_id: workstream.id,
        brief,
        start_date: startDate,
        pricing_tier_id: pricingTier.id,
        account_id: accountId,
        description: optionalString(body.description),
        status: 'planning',
      })
      .select('id, name')
      .single()

    if (error) {
      throw error
    }

    const plan = await planProjectFromBrief({
      projectId: project.id,
      projectName: project.name,
      workstreamId: workstream.id,
      pricingTierId: pricingTier.id,
      startDate,
      brief,
    })

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(
      /\/$/,
      ''
    )

    return Response.json({
      project_id: project.id,
      project_name: project.name,
      tasks_created: plan.tasks_created,
      milestones_created: plan.milestones_created,
      phases_created: plan.phases_created,
      estimated_end_date: plan.estimated_end_date,
      url: `${baseUrl}/projects/${project.id}`,
    })
  } catch (error) {
    return jsonError(error, 'Failed to create project')
  }
}
