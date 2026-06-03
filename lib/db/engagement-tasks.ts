import { createClient } from '@/lib/supabase/server'
import type {
  EngagementTaskActivity,
  EngagementTaskCommentWithAuthor,
  EngagementTaskWithRelations,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const TASK_SELECT =
  '*, assignee:people!assignee_person_id(id, full_name), reporter:people!reporter_person_id(id, full_name), engagement:engagements(id, name)'

/** All tasks on one engagement (RLS scopes what the caller can see). For the kanban board. */
export async function listEngagementTasks(
  engagementId: string,
  client?: SupabaseClient
): Promise<EngagementTaskWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_tasks')
    .select(TASK_SELECT)
    .eq('engagement_id', engagementId)
    .order('status')
    .order('position', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load tasks')
  return (data ?? []) as unknown as EngagementTaskWithRelations[]
}

export type MyTaskMode = 'assigned' | 'reported' | 'engagements'

/** Personal-board queries. RLS already restricts visibility; these scope further by mode. */
export async function listMyTasks(
  mode: MyTaskMode,
  personId: string,
  client?: SupabaseClient
): Promise<EngagementTaskWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('engagement_tasks').select(TASK_SELECT)

  if (mode === 'assigned') {
    query = query.eq('assignee_person_id', personId)
  } else if (mode === 'reported') {
    query = query.eq('reporter_person_id', personId)
  } else {
    // All tasks on engagements this person actively contributes to.
    const { data: ecs } = await supabase
      .from('engagement_contributors')
      .select('engagement_id')
      .eq('person_id', personId)
      .eq('is_active', true)
    const ids = (ecs ?? []).map((e) => e.engagement_id)
    if (ids.length === 0) return []
    query = query.in('engagement_id', ids)
  }

  // due_date asc nulls last, then created desc (priority ordering applied client-side).
  const { data, error } = await query.order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load tasks')
  return (data ?? []) as unknown as EngagementTaskWithRelations[]
}

export async function getEngagementTask(id: string, client?: SupabaseClient): Promise<EngagementTaskWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('engagement_tasks').select(TASK_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load task')
  return (data as unknown as EngagementTaskWithRelations | null) ?? null
}

export async function listTaskComments(taskId: string, client?: SupabaseClient): Promise<EngagementTaskCommentWithAuthor[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_task_comments')
    .select('*, author:people!author_person_id(id, full_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load comments')
  return (data ?? []) as unknown as EngagementTaskCommentWithAuthor[]
}

export async function listTaskActivity(taskId: string, client?: SupabaseClient): Promise<EngagementTaskActivity[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_task_activity')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load activity')
  return (data ?? []) as unknown as EngagementTaskActivity[]
}
