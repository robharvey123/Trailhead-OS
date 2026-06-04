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
