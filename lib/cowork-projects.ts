import {
  CoworkApiError,
  PROJECT_SELECT,
  getProjectById,
  isUuid,
  noRecognisedFieldsError,
  optionalDate,
  optionalString,
  parseProjectStatus,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
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
]

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

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, ['completed', 'date', 'name'])
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('project_milestones')
    .update(patch)
    .eq('id', milestoneId)
    .select('id, project_id, name, description, date, completed, completed_at')
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

  if (body.start_date !== undefined) patch.start_date = optionalDate(body.start_date, 'start_date')
  if (body.end_date !== undefined) patch.end_date = optionalDate(body.end_date, 'end_date')

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) {
      throw noRecognisedFieldsError(body, ['name', 'start_date', 'end_date'])
    }
    throw new CoworkApiError('No changes supplied', 400)
  }

  const { data, error } = await supabaseService
    .from('project_phases')
    .update(patch)
    .eq('id', phaseId)
    .select('id, project_id, name, description, sort_order, start_date, end_date')
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
