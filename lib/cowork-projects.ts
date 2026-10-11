import {
  CoworkApiError,
  PROJECT_SELECT,
  getProjectById,
  getWorkstreamBySlug,
  isUuid,
  noRecognisedFieldsError,
  optionalDate,
  optionalNumber,
  optionalString,
  parseProjectStatus,
  requiredString,
  todayDate,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { planProjectFromBrief } from '@/lib/project-planner'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Shared project write logic for the Cowork REST API *and* the MCP server —
 * same contract as lib/cowork-tasks.ts: one validation path, helpers throw
 * `CoworkApiError`, routes map that via `jsonError`, MCP wraps thrown errors.
 *
 * Exists because the projects PATCH could not set `engagement_id`, so every
 * project created over the API orphaned from its engagement and
 * `bulk_create_engagement_tasks` (which reads `projects.engagement_id` at
 * insert time) minted tickets that never reconciled hours (WNF-WEB-26,
 * 23 Aug 2026).
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const PROJECT_PATCH_FIELDS = [
  'name',
  'description',
  'status',
  'start_date',
  'end_date',
  'account_id',
  'engagement_id',
  'brief',
  'estimated_end_date',
  'workstream',
  'tier',
  'hourly_rate',
  'currency',
  'colour',
]

export const PHASE_FIELDS = ['name', 'description', 'sort_order', 'start_date', 'end_date']
export const MILESTONE_FIELDS = ['name', 'description', 'date', 'completed']

const PHASE_SELECT = 'id, project_id, name, description, sort_order, start_date, end_date'
const MILESTONE_SELECT = 'id, project_id, name, description, date, completed, completed_at'

async function getPricingTierId(slug: string) {
  const { data, error } = await supabaseService
    .from('pricing_tiers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load pricing tier', 500)
  if (!data) throw new CoworkApiError(`Pricing tier not found: ${slug}`, 400)
  return data.id as string
}

function optionalSortOrder(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isInteger(num)) throw new CoworkApiError('sort_order must be an integer', 400)
  return num
}

/**
 * POST /api/cowork/projects and the MCP `create_project` tool. The AI planner
 * runs by default; `plan: false` creates a bare project so the caller can
 * build phases, milestones and tasks itself (the planner's generic
 * Discovery/Build/Launch template cost a full rebuild on 11 Oct 2026).
 */
export async function createCoworkProject(body: Record<string, unknown>) {
  const name = requiredString(body.name, 'name')
  const workstream = await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))
  const runPlanner = body.plan !== false
  const brief = runPlanner ? requiredString(body.brief, 'brief') : optionalString(body.brief)
  const startDate = optionalDate(body.start_date, 'start_date') ?? todayDate()
  const pricingTierId = await getPricingTierId(optionalString(body.tier) ?? 'budget')
  const accountName = optionalString(body.account_name)

  let accountId: string | null = null
  if (body.account_id !== undefined && body.account_id !== null) {
    accountId = nullableUuid(body.account_id, 'account_id')
    if (accountId) await getAccountName(accountId)
  } else if (accountName) {
    const { data: account, error: accountError } = await supabaseService
      .from('accounts')
      .select('id')
      .eq('record_type', 'sales')
      .ilike('name', accountName)
      .limit(1)
      .maybeSingle()
    if (accountError) throw new CoworkApiError(accountError.message || 'Failed to load account', 500)
    if (!account) throw new CoworkApiError(`Account not found: ${accountName}`, 400)
    accountId = account.id as string
  }

  const { data: project, error } = await supabaseService
    .from('projects')
    .insert({
      name,
      workstream_id: workstream.id,
      brief,
      start_date: startDate,
      end_date: optionalDate(body.end_date, 'end_date'),
      pricing_tier_id: pricingTierId,
      account_id: accountId,
      description: optionalString(body.description),
      status: body.status !== undefined ? parseProjectStatus(body.status) : 'planning',
    })
    .select('id, name')
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create project', 500)

  // Link before planning so any tickets minted later inherit the engagement.
  if (body.engagement_id !== undefined && body.engagement_id !== null) {
    await updateCoworkProject(project.id as string, { engagement_id: body.engagement_id })
  }

  const plan = runPlanner
    ? await planProjectFromBrief({
        projectId: project.id,
        projectName: project.name,
        workstreamId: workstream.id,
        pricingTierId,
        startDate,
        brief: brief as string,
      })
    : { tasks_created: 0, milestones_created: 0, phases_created: 0, estimated_end_date: null }

  void recordCoworkWrite({
    action: 'create',
    entity: 'project',
    entityId: project.id as string,
    entityLabel: project.name as string,
    summary: `Created project "${project.name}"${runPlanner ? ' (AI planned)' : ''}`,
    payload: body,
  })

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(
    /\/$/,
    ''
  )

  return {
    project_id: project.id as string,
    project_name: project.name as string,
    planned: runPlanner,
    tasks_created: plan.tasks_created,
    milestones_created: plan.milestones_created,
    phases_created: plan.phases_created,
    estimated_end_date: plan.estimated_end_date,
    url: `${baseUrl}/projects/${project.id}`,
  }
}

function nullableUuid(value: unknown, field: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new CoworkApiError(`${field} must be a uuid or null`, 400)
  }
  return value
}

type EngagementRef = {
  id: string
  name: string
  code: string | null
  end_client_account_id: string | null
}

async function getEngagementRef(id: string): Promise<EngagementRef> {
  const { data, error } = await supabaseService
    .from('engagements')
    .select('id, name, code, end_client_account_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load engagement', 500)
  if (!data) throw new CoworkApiError(`engagement_id not found: ${id}`, 400)
  return data as EngagementRef
}

async function getAccountName(id: string): Promise<string> {
  const { data, error } = await supabaseService
    .from('accounts')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new CoworkApiError(error.message || 'Failed to load account', 500)
  if (!data) throw new CoworkApiError(`account_id not found: ${id}`, 400)
  return data.name as string
}

/** PATCH /api/cowork/projects/[id] and the MCP `update_project` tool. */
export async function updateCoworkProject(id: string, body: Record<string, unknown>) {
  const existing = await getProjectById(id)
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = optionalString(body.name)
    if (!name) throw new CoworkApiError('name is required', 400)
    patch.name = name
  }

  if (body.status !== undefined) patch.status = parseProjectStatus(body.status)
  if (body.description !== undefined) patch.description = optionalString(body.description)
  if (body.start_date !== undefined) patch.start_date = optionalDate(body.start_date, 'start_date')
  if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, 'end_date')
  if (body.brief !== undefined) patch.brief = optionalString(body.brief)
  if (body.estimated_end_date !== undefined) {
    patch.estimated_end_date = optionalDate(body.estimated_end_date, 'estimated_end_date')
  }
  if (body.workstream !== undefined) {
    patch.workstream_id = (await getWorkstreamBySlug(requiredString(body.workstream, 'workstream'))).id
  }
  if (body.tier !== undefined) {
    patch.pricing_tier_id = body.tier === null ? null : await getPricingTierId(requiredString(body.tier, 'tier'))
  }
  if (body.hourly_rate !== undefined) patch.hourly_rate = optionalNumber(body.hourly_rate, 'hourly_rate')
  if (body.currency !== undefined) {
    const currency = optionalString(body.currency)
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) {
      throw new CoworkApiError('currency must be a 3-letter code', 400)
    }
    patch.currency = currency ? currency.toUpperCase() : null
  }
  if (body.colour !== undefined) patch.colour = optionalString(body.colour)

  // engagement_id / account_id both validate against the DB before writing,
  // and the pair is cross-checked so a link that will not reconcile against
  // the engagement's end client is refused (409), not silently written. The
  // check runs whenever EITHER side changes — patching account_id after the
  // link must not sneak past it.
  let engagement: EngagementRef | null = null

  if (body.engagement_id !== undefined) {
    const engagementId = nullableUuid(body.engagement_id, 'engagement_id')
    engagement = engagementId ? await getEngagementRef(engagementId) : null
    patch.engagement_id = engagementId
  }

  if (body.account_id !== undefined) {
    const accountId = nullableUuid(body.account_id, 'account_id')
    if (accountId) await getAccountName(accountId)
    patch.account_id = accountId
  }

  if (body.engagement_id !== undefined || body.account_id !== undefined) {
    const effectiveEngagement =
      body.engagement_id !== undefined
        ? engagement
        : existing.engagement_id
          ? await getEngagementRef(existing.engagement_id as string)
          : null
    const effectiveAccountId =
      body.account_id !== undefined
        ? (patch.account_id as string | null)
        : ((existing.account_id as string | null) ?? null)

    if (
      effectiveEngagement?.end_client_account_id &&
      effectiveAccountId &&
      effectiveEngagement.end_client_account_id !== effectiveAccountId
    ) {
      const [endClientName, accountName] = await Promise.all([
        getAccountName(effectiveEngagement.end_client_account_id),
        getAccountName(effectiveAccountId),
      ])
      throw new CoworkApiError(
        `Engagement "${effectiveEngagement.code ?? effectiveEngagement.name}" belongs to end client "${endClientName}" but the project's account is "${accountName}" — link refused so hours reconcile. Change the project's account_id or pick the matching engagement.`,
        409
      )
    }
  }

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, PROJECT_PATCH_FIELDS)
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select(PROJECT_SELECT)
    .single()

  if (error) throw new CoworkApiError(error.message || 'Failed to update project', 500)

  void recordCoworkWrite({
    action: 'update',
    entity: 'project',
    entityId: id,
    entityLabel: (data as { name?: string }).name ?? null,
    engagementId:
      ((data as { engagement_id?: string | null }).engagement_id ?? null) as string | null,
    summary: `Updated project "${(data as { name?: string }).name}" (${Object.keys(patch).join(', ')})`,
    payload: body,
  })

  return data
}

/**
 * PATCH /api/cowork/projects/[id]/milestones/[milestoneId].
 * `completed` flips stamp/clear `completed_at`; `date` and `name` editable.
 */
export async function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  body: Record<string, unknown>
) {
  await getProjectById(projectId)

  const { data: milestone, error: loadError } = await supabaseService
    .from('project_milestones')
    .select('id, project_id, name, completed, completed_at')
    .eq('id', milestoneId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (loadError) throw new CoworkApiError(loadError.message || 'Failed to load milestone', 500)
  if (!milestone) throw new CoworkApiError('Milestone not found on this project', 404)

  const patch: Record<string, unknown> = {}

  if (body.completed !== undefined) {
    if (typeof body.completed !== 'boolean') {
      throw new CoworkApiError('completed must be a boolean', 400)
    }
    patch.completed = body.completed
    patch.completed_at = body.completed
      ? (milestone.completed_at ?? new Date().toISOString())
      : null
  }

  if (body.date !== undefined) {
    const date = optionalDate(body.date, 'date')
    if (!date) throw new CoworkApiError('date cannot be cleared', 400)
    patch.date = date
  }

  if (body.name !== undefined) {
    const name = optionalString(body.name)
    if (!name) throw new CoworkApiError('name is required', 400)
    patch.name = name
  }

  if (body.description !== undefined) patch.description = optionalString(body.description)

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, MILESTONE_FIELDS)
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('project_milestones')
    .update(patch)
    .eq('id', milestoneId)
    .select(MILESTONE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update milestone', 500)

  void recordCoworkWrite({
    action: 'update',
    entity: 'project_milestone',
    entityId: milestoneId,
    entityLabel: data.name as string,
    summary: `Updated milestone "${data.name}" (${Object.keys(patch).join(', ')})`,
    payload: body,
  })

  return data
}

/**
 * PATCH /api/cowork/projects/[id]/phases/[phaseId] — the AI planner sets
 * phase dates weeks out; this is the correction path.
 */
export async function updateProjectPhase(
  projectId: string,
  phaseId: string,
  body: Record<string, unknown>
) {
  await getProjectById(projectId)

  const { data: phase, error: loadError } = await supabaseService
    .from('project_phases')
    .select('id, project_id, name')
    .eq('id', phaseId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (loadError) throw new CoworkApiError(loadError.message || 'Failed to load phase', 500)
  if (!phase) throw new CoworkApiError('Phase not found on this project', 404)

  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = optionalString(body.name)
    if (!name) throw new CoworkApiError('name is required', 400)
    patch.name = name
  }

  if (body.description !== undefined) patch.description = optionalString(body.description)
  if (body.sort_order !== undefined) {
    const sortOrder = optionalSortOrder(body.sort_order)
    if (sortOrder === null) throw new CoworkApiError('sort_order cannot be cleared', 400)
    patch.sort_order = sortOrder
  }
  if (body.start_date !== undefined) patch.start_date = optionalDate(body.start_date, 'start_date')
  if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, 'end_date')

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, PHASE_FIELDS)
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('project_phases')
    .update(patch)
    .eq('id', phaseId)
    .select(PHASE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update phase', 500)

  void recordCoworkWrite({
    action: 'update',
    entity: 'project_phase',
    entityId: phaseId,
    entityLabel: data.name as string,
    summary: `Updated phase "${data.name}" (${Object.keys(patch).join(', ')})`,
    payload: body,
  })

  return data
}

/** POST /api/cowork/projects/[id]/phases. Appends after the last phase unless sort_order is sent. */
export async function createProjectPhase(projectId: string, body: Record<string, unknown>) {
  await getProjectById(projectId)
  const name = requiredString(body.name, 'name')

  let sortOrder = optionalSortOrder(body.sort_order)
  if (sortOrder === null) {
    const { data: last, error: lastError } = await supabaseService
      .from('project_phases')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastError) throw new CoworkApiError(lastError.message || 'Failed to load phases', 500)
    sortOrder = last ? (last.sort_order as number) + 1 : 0
  }

  const { data, error } = await supabaseService
    .from('project_phases')
    .insert({
      project_id: projectId,
      name,
      description: optionalString(body.description),
      sort_order: sortOrder,
      start_date: optionalDate(body.start_date, 'start_date'),
      end_date: optionalDate(body.end_date, 'end_date'),
    })
    .select(PHASE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create phase', 500)

  void recordCoworkWrite({
    action: 'create',
    entity: 'project_phase',
    entityId: data.id as string,
    entityLabel: data.name as string,
    summary: `Created phase "${data.name}"`,
    payload: body,
  })

  return data
}

/** DELETE /api/cowork/projects/[id]/phases/[phaseId]. Tasks in the phase stay on the project, unphased. */
export async function deleteProjectPhase(projectId: string, phaseId: string) {
  await getProjectById(projectId)
  const { data: phase, error: loadError } = await supabaseService
    .from('project_phases')
    .select(PHASE_SELECT)
    .eq('id', phaseId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (loadError) throw new CoworkApiError(loadError.message || 'Failed to load phase', 500)
  if (!phase) throw new CoworkApiError('Phase not found on this project', 404)

  const { error } = await supabaseService.from('project_phases').delete().eq('id', phaseId)
  if (error) throw new CoworkApiError(error.message || 'Failed to delete phase', 500)

  void recordCoworkWrite({
    action: 'delete',
    entity: 'project_phase',
    entityId: phaseId,
    entityLabel: phase.name as string,
    summary: `Deleted phase "${phase.name}"`,
    payload: phase,
  })

  return { deleted: true }
}

/** POST /api/cowork/projects/[id]/milestones. */
export async function createProjectMilestone(projectId: string, body: Record<string, unknown>) {
  await getProjectById(projectId)
  const name = requiredString(body.name, 'name')
  const date = optionalDate(body.date, 'date')
  if (!date) throw new CoworkApiError('date is required', 400)
  const completed = body.completed === true

  const { data, error } = await supabaseService
    .from('project_milestones')
    .insert({
      project_id: projectId,
      name,
      description: optionalString(body.description),
      date,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .select(MILESTONE_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create milestone', 500)

  void recordCoworkWrite({
    action: 'create',
    entity: 'project_milestone',
    entityId: data.id as string,
    entityLabel: data.name as string,
    summary: `Created milestone "${data.name}" (${data.date})`,
    payload: body,
  })

  return data
}

/** DELETE /api/cowork/projects/[id]/milestones/[milestoneId]. */
export async function deleteProjectMilestone(projectId: string, milestoneId: string) {
  await getProjectById(projectId)
  const { data: milestone, error: loadError } = await supabaseService
    .from('project_milestones')
    .select(MILESTONE_SELECT)
    .eq('id', milestoneId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (loadError) throw new CoworkApiError(loadError.message || 'Failed to load milestone', 500)
  if (!milestone) throw new CoworkApiError('Milestone not found on this project', 404)

  const { error } = await supabaseService.from('project_milestones').delete().eq('id', milestoneId)
  if (error) throw new CoworkApiError(error.message || 'Failed to delete milestone', 500)

  void recordCoworkWrite({
    action: 'delete',
    entity: 'project_milestone',
    entityId: milestoneId,
    entityLabel: milestone.name as string,
    summary: `Deleted milestone "${milestone.name}"`,
    payload: milestone,
  })

  return { deleted: true }
}
