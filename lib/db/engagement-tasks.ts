import { createClient } from '@/lib/supabase/server'
import type {
  EngagementTask,
  EngagementTaskActivity,
  EngagementTaskCommentWithAuthor,
  EngagementTaskPriority,
  EngagementTaskStatus,
  EngagementTaskWithRelations,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const TASK_SELECT =
  '*, assignee:people!assignee_person_id(id, full_name), reporter:people!reporter_person_id(id, full_name), engagement:engagements(id, name), project:projects(id, name)'

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

/** Tasks scoped to a single project (project_id) — for the project detail board. */
export async function listProjectTasks(
  projectId: string,
  client?: SupabaseClient
): Promise<EngagementTaskWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)
    .order('status')
    .order('position', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load project tasks')
  return (data ?? []) as unknown as EngagementTaskWithRelations[]
}

/** Optional status/priority filters for the project-scoped task list. */
export interface ProjectEngagementTaskFilters {
  status?: EngagementTaskStatus
  priority?: EngagementTaskPriority
}

/**
 * Project-scoped task list with optional status/priority filters. Backs the MCP
 * `list_engagement_tasks` tool. Like {@link listProjectTasks} but filterable.
 */
export async function listProjectEngagementTasks(
  projectId: string,
  filters: ProjectEngagementTaskFilters = {},
  client?: SupabaseClient
): Promise<EngagementTaskWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('engagement_tasks')
    .select(TASK_SELECT)
    .eq('project_id', projectId)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }

  const { data, error } = await query
    .order('status')
    .order('position', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load project tasks')
  return (data ?? []) as unknown as EngagementTaskWithRelations[]
}

/** One row for {@link bulkCreateEngagementTasks}. */
export interface BulkEngagementTaskInput {
  title: string
  description?: string | null
  status?: EngagementTaskStatus
  priority?: EngagementTaskPriority
  due_date?: string | null
  labels?: string[]
}

/**
 * Insert many engagement_tasks against one project in a single call — for
 * roadmap imports driven from Claude (MCP `bulk_create_engagement_tasks`).
 *
 * The engagement is derived from the project (mirroring the roadmap-import
 * commit flow): tasks inherit the project's `engagement_id`. `position` is
 * auto-assigned sequentially from the current max on the project so new rows
 * append after any existing ones.
 */
export async function bulkCreateEngagementTasks(
  projectId: string,
  tasks: BulkEngagementTaskInput[],
  client?: SupabaseClient
): Promise<EngagementTask[]> {
  if (tasks.length === 0) {
    throw new Error('Provide at least one task to create')
  }

  const supabase = await getSupabase(client)

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, engagement_id')
    .eq('id', projectId)
    .maybeSingle()
  if (projectError) throw new Error(projectError.message || 'Failed to load project')
  if (!project) throw new Error(`Project not found: ${projectId}`)

  // Append after existing tasks on this project rather than colliding at 0.
  const { data: lastRow, error: lastError } = await supabase
    .from('engagement_tasks')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lastError) throw new Error(lastError.message || 'Failed to load task positions')
  let position = (lastRow?.position ?? 0) + 1

  const rows = tasks.map((task) => {
    const title = task.title?.trim()
    if (!title) throw new Error('Each task needs a non-empty title')
    return {
      engagement_id: project.engagement_id ?? null,
      project_id: projectId,
      title,
      description: task.description?.trim() || null,
      status: task.status ?? 'backlog',
      priority: task.priority ?? 'normal',
      due_date: task.due_date || null,
      labels: task.labels ?? [],
      position: position++,
    }
  })

  const { data, error } = await supabase.from('engagement_tasks').insert(rows).select('*')
  if (error) throw new Error(error.message || 'Failed to create tasks')
  return (data ?? []) as EngagementTask[]
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
