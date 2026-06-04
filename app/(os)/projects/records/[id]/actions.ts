'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/roles'

function revalidateProject(projectId: string, ...engagementIds: Array<string | null | undefined>) {
  revalidatePath('/projects')
  revalidatePath(`/projects/records/${projectId}`)
  for (const e of engagementIds) if (e) revalidatePath(`/engagements/${e}`)
}

/** End a project (completed | cancelled), optionally cancelling its open tasks — atomic via the end_project RPC. */
export async function endProject(input: {
  id: string
  outcome: 'completed' | 'cancelled'
  reason?: string
  cancelOpenTasks?: boolean
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  if (input.outcome !== 'completed' && input.outcome !== 'cancelled') return { error: 'Invalid outcome' }

  const { error } = await supabase.rpc('end_project', {
    p_id: input.id,
    p_outcome: input.outcome,
    p_reason: input.reason ?? null,
    p_cancel_tasks: !!input.cancelOpenTasks,
  })
  if (error) return { error: error.message }

  revalidateProject(input.id)
  return {}
}

/** Reopen an ended project. Does NOT un-cancel previously cancelled tasks (by design). */
export async function reopenProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  const { error } = await supabase
    .from('projects')
    .update({ status: 'active', ended_at: null, ended_reason: null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateProject(id)
  return {}
}

/** Set/change the project's engagement link. */
export async function setProjectEngagement(projectId: string, engagementId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  if (!engagementId) return { error: 'Choose an engagement' }

  // Capture the previous engagement so we can revalidate both sides.
  const { data: before } = await supabase.from('projects').select('engagement_id').eq('id', projectId).maybeSingle()
  const { error } = await supabase.from('projects').update({ engagement_id: engagementId }).eq('id', projectId)
  if (error) return { error: error.message }

  revalidateProject(projectId, before?.engagement_id, engagementId)
  return {}
}

// ── Milestone delete (single + bulk) ───────────────────────────────────────
// Dependents are a SOFT link: tasks.custom_fields.milestone_id (no FK). We BLOCK
// delete when linked tasks exist so the tag isn't silently orphaned. Hard delete
// (milestones are plan items, not financial records).
const MAX_BULK = 100

async function milestoneTaskCount(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<number> {
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('custom_fields->>milestone_id', id)
  return count ?? 0
}

export async function deleteMilestone(id: string): Promise<{ error?: string; blockedCount?: number }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  const blocked = await milestoneTaskCount(supabase, id)
  if (blocked > 0) {
    return { blockedCount: blocked, error: `This milestone has ${blocked} linked task${blocked === 1 ? '' : 's'}. Reassign or delete them first.` }
  }
  const { data: row } = await supabase.from('project_milestones').select('project_id').eq('id', id).maybeSingle()
  const { error } = await supabase.from('project_milestones').delete().eq('id', id)
  if (error) return { error: error.message }
  if (row?.project_id) revalidatePath(`/projects/records/${row.project_id}`)
  revalidatePath('/projects')
  return {}
}

export async function deleteMilestones(
  ids: string[]
): Promise<{ error?: string; deleted?: number; blocked?: Record<string, number> }> {
  const supabase = await createClient()
  try {
    await requireAdmin(supabase)
  } catch {
    return { error: 'Not authorised' }
  }
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'No milestones selected' }
  if (ids.length > MAX_BULK) return { error: `Too many at once (max ${MAX_BULK})` }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!ids.every((id) => UUID.test(id))) return { error: 'Invalid milestone id' }

  // Single dependents query across all ids; block the whole batch if any have tasks.
  const { data: linked } = await supabase
    .from('tasks')
    .select('custom_fields')
    .in('custom_fields->>milestone_id', ids)
  const blocked: Record<string, number> = {}
  for (const row of (linked ?? []) as Array<{ custom_fields: Record<string, unknown> | null }>) {
    const mid = (row.custom_fields?.milestone_id ?? row.custom_fields?.milestoneId) as string | undefined
    if (mid && ids.includes(mid)) blocked[mid] = (blocked[mid] ?? 0) + 1
  }
  if (Object.keys(blocked).length > 0) return { blocked }

  const { data: rows } = await supabase.from('project_milestones').select('project_id').in('id', ids).limit(1)
  const { error } = await supabase.from('project_milestones').delete().in('id', ids)
  if (error) return { error: error.message }
  const projectId = rows?.[0]?.project_id
  if (projectId) revalidatePath(`/projects/records/${projectId}`)
  revalidatePath('/projects')
  return { deleted: ids.length }
}
