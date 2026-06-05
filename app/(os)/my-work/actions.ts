'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/roles'
import { createTimeEntry } from '@/lib/db/timesheet'
import { contributorRate } from '@/lib/db/contributors'
import type { EngagementTask, EngagementTaskPriority, EngagementTaskStatus } from '@/lib/types'

async function currentPersonId() {
  const profile = await getCurrentProfile()
  return profile?.person_id ?? null
}

function revalidateTask(engagementId?: string | null, taskId?: string) {
  revalidatePath('/tasks') // canonical engagement_tasks views
  revalidatePath('/dashboard') // active-project-tasks widget
  revalidatePath('/my-work')
  if (taskId) revalidatePath(`/my-work/${taskId}`)
  if (engagementId) revalidatePath(`/engagements/${engagementId}/tasks`)
}

export interface CreateTaskInput {
  title: string
  description?: string | null
  engagementId?: string | null
  projectId?: string | null
  assigneePersonId?: string | null
  priority?: EngagementTaskPriority
  dueDate?: string | null
  labels?: string[]
}

export async function createTask(input: CreateTaskInput): Promise<{ task?: EngagementTask; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const personId = await currentPersonId()
  if (!personId) return { error: 'Your login has no linked person record — ask an admin to link one.' }
  if (!input.title?.trim()) return { error: 'Title is required' }

  // Reporter is always the current person — never trusted from client input.
  const { data, error } = await supabase
    .from('engagement_tasks')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      engagement_id: input.engagementId || null,
      project_id: input.projectId || null,
      assignee_person_id: input.assigneePersonId || null,
      reporter_person_id: personId,
      priority: input.priority ?? 'normal',
      due_date: input.dueDate || null,
      labels: input.labels ?? [],
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) return { error: error.message }
  revalidateTask(data.engagement_id, data.id)
  if (input.projectId) revalidatePath(`/projects/records/${input.projectId}`)
  return { task: data as EngagementTask }
}

export async function updateTask(
  id: string,
  patch: { title?: string; description?: string | null; priority?: EngagementTaskPriority; dueDate?: string | null; labels?: string[] }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) update.title = patch.title.trim()
  if (patch.description !== undefined) update.description = patch.description?.trim() || null
  if (patch.priority !== undefined) update.priority = patch.priority
  if (patch.dueDate !== undefined) update.due_date = patch.dueDate || null
  if (patch.labels !== undefined) update.labels = patch.labels
  const { data, error } = await supabase.from('engagement_tasks').update(update).eq('id', id).select('engagement_id').single()
  if (error) return { error: error.message }
  revalidateTask(data?.engagement_id, id)
  return {}
}

/** Kanban drag-drop. status_changed activity + completed_at are handled by DB triggers. */
export async function moveTask(id: string, status: EngagementTaskStatus, position: number): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_tasks')
    .update({ status, position })
    .eq('id', id)
    .select('engagement_id')
    .single()
  if (error) return { error: error.message }
  revalidateTask(data?.engagement_id, id)
  return {}
}

export async function assignTask(id: string, personId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('engagement_tasks')
    .update({ assignee_person_id: personId })
    .eq('id', id)
    .select('engagement_id')
    .single()
  if (error) return { error: error.message }
  revalidateTask(data?.engagement_id, id)
  return {}
}

export async function addComment(taskId: string, body: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const personId = await currentPersonId()
  if (!personId) return { error: 'Your login has no linked person record — cannot comment.' }
  if (!body?.trim()) return { error: 'Comment is empty' }
  const { error } = await supabase
    .from('engagement_task_comments')
    .insert({ task_id: taskId, author_person_id: personId, body: body.trim() })
  if (error) return { error: error.message }
  revalidatePath(`/my-work/${taskId}`)
  return {}
}

/**
 * Log a manual time entry against a task. Resolves engagement/project from the
 * task, attributes the entry to the caller's person, and snapshots the rate from
 * engagement_contributors (reusing createTimeEntry's rate logic — same as the
 * timer stop flow). Logging against an engagement-linked task requires you to be
 * an active contributor on that engagement.
 */
export async function logTaskTime(
  taskId: string,
  input: { hours: number; date: string; description?: string; billable: boolean }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const personId = await currentPersonId()
  if (!personId) return { error: 'Your login has no linked person record — cannot log time.' }

  const minutes = Math.round((Number(input.hours) || 0) * 60)
  if (minutes <= 0) return { error: 'Enter a number of hours greater than zero.' }

  const { data: task } = await supabase
    .from('engagement_tasks')
    .select('id, engagement_id, project_id')
    .eq('id', taskId)
    .maybeSingle()
  if (!task) return { error: 'Task not found.' }

  // Contributor gate: an engagement-linked task can only be timed by an active
  // contributor (the rate snapshot would otherwise be meaningless).
  if (task.engagement_id) {
    const rate = await contributorRate(task.engagement_id, personId, supabase)
    if (rate == null) return { error: 'You must be a contributor on this engagement to log time against its tasks.' }
  }

  try {
    await createTimeEntry(
      {
        task_id: taskId,
        engagement_id: task.engagement_id,
        project_id: task.project_id,
        person_id: personId,
        entry_date: input.date,
        duration_minutes: minutes,
        description: input.description?.trim() || null,
        billable: input.billable,
      },
      supabase
    )
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to log time.' }
  }

  revalidatePath(`/my-work/${taskId}`)
  if (task.project_id) revalidatePath(`/projects/records/${task.project_id}`)
  return {}
}

export async function markRead(taskId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const personId = await currentPersonId()
  if (!personId) return {}
  const { error } = await supabase
    .from('engagement_task_read_state')
    .upsert({ person_id: personId, task_id: taskId, last_read_at: new Date().toISOString() }, { onConflict: 'person_id,task_id' })
  if (error) return { error: error.message }
  return {}
}
