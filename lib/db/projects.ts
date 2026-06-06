import { createClient } from '@/lib/supabase/server'
import type {
  Account,
  Contact,
  Project,
  TaskActivityEntry,
  TaskAttachment,
  TaskChecklistItem,
  TaskDependency,
  ProjectDetail,
  ProjectListItem,
  ProjectMilestone,
  ProjectPhase,
  ProjectStatus,
  QuoteScope,
  TaskTimeLog,
  Workstream,
} from '@/lib/types'
import { getTasks } from './tasks'
import { getEnquiries } from './enquiries'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type ProjectRow = Project & {
  workstreams: Workstream | null
  accounts: Account | null
}

type RelationValue<T> = T | T[] | null


type ProjectContactRow = {
  project_id?: string
  contact_id: string
  relationship_role: string | null
  created_at: string
  contacts: RelationValue<Contact>
}

export interface ProjectFilters {
  workstream_id?: string
  account_id?: string
  contact_id?: string
  status?: ProjectStatus
  search?: string
}

export interface CreateProjectInput {
  workstream_id?: string | null
  account_id?: string | null
  engagement_id?: string | null
  owner_id?: string | null
  pricing_tier_id?: string | null
  name: string
  description?: string | null
  brief?: string | null
  status?: ProjectStatus
  start_date?: string | null
  end_date?: string | null
  estimated_end_date?: string | null
}

export type UpdateProjectInput = Partial<CreateProjectInput>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function firstRelation<T>(value: RelationValue<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    workstream_id: row.workstream_id,
    account_id: row.account_id,
    owner_id: row.owner_id,
    pricing_tier_id: row.pricing_tier_id,
    name: row.name,
    title: row.title ?? row.name,
    description: row.description,
    brief: row.brief,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    estimated_end_date: row.estimated_end_date,
    colour: row.colour ?? null,
    owner: row.owner ?? null,
    ai_planned: row.ai_planned,
    engagement_id: row.engagement_id ?? null,
    ended_at: row.ended_at ?? null,
    ended_reason: row.ended_reason ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function mapProjectListItem(
  row: ProjectRow,
  taskCounts: { total: number; completed: number },
  contacts: Contact[],
  milestones: ProjectMilestone[]
): ProjectListItem {
  const nextMilestone =
    milestones.find(
      (milestone) => !milestone.completed && milestone.date >= new Date().toISOString().slice(0, 10)
    ) ?? milestones[0] ?? null

  return {
    ...mapProjectRow(row),
    workstream: row.workstreams,
    account: row.accounts,
    task_count: taskCounts.total,
    completed_task_count: taskCounts.completed,
    contact_count: contacts.length,
    next_milestone: nextMilestone,
  }
}


function sanitizeProjectPayload(data: CreateProjectInput | UpdateProjectInput) {
  const payload: Record<string, unknown> = {}

  if ('workstream_id' in data) payload.workstream_id = data.workstream_id
  if ('account_id' in data) payload.account_id = data.account_id ?? null
  if ('engagement_id' in data) payload.engagement_id = data.engagement_id ?? null
  if ('owner_id' in data) payload.owner_id = data.owner_id ?? null
  if ('pricing_tier_id' in data) payload.pricing_tier_id = data.pricing_tier_id ?? null
  if ('name' in data && data.name !== undefined) payload.name = data.name.trim()
  if ('description' in data) payload.description = data.description?.trim() || null
  if ('brief' in data) payload.brief = data.brief?.trim() || null
  if ('status' in data) payload.status = data.status
  if ('start_date' in data) payload.start_date = data.start_date ?? null
  if ('end_date' in data) payload.end_date = data.end_date ?? null
  if ('estimated_end_date' in data) payload.estimated_end_date = data.estimated_end_date ?? null

  return payload
}

export async function getProjects(
  filters: ProjectFilters = {},
  client?: SupabaseClient
): Promise<ProjectListItem[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('projects')
    .select('*, workstreams(*), accounts(*)')
    .order('start_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim()
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,brief.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load projects')
  }

  let rows = (data ?? []) as ProjectRow[]

  if (rows.length === 0) {
    return []
  }

  const projectIds = rows.map((row) => row.id)
  const [tasksResult, contactsResult, milestonesResult] = await Promise.all([
    // Project work lives in engagement_tasks (the OS `tasks` table is retired);
    // the card tally counts those. 'done' = completed.
    supabase
      .from('engagement_tasks')
      .select('project_id, status')
      .in('project_id', projectIds),
    supabase
      .from('project_contacts')
      .select('project_id, contact_id, relationship_role, created_at, contacts(*)')
      .in('project_id', projectIds),
    supabase
      .from('project_milestones')
      .select('*')
      .in('project_id', projectIds)
      .order('date', { ascending: true }),
  ])

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message || 'Failed to load project tasks')
  }

  if (contactsResult.error) {
    throw new Error(contactsResult.error.message || 'Failed to load project contacts')
  }

  if (milestonesResult.error) {
    throw new Error(milestonesResult.error.message || 'Failed to load project milestones')
  }

  if (filters.contact_id) {
    const matchingProjectIds = new Set(
      (contactsResult.data ?? [])
        .filter((item) => item.contact_id === filters.contact_id)
        .map((item) => item.project_id)
    )
    rows = rows.filter((row) => matchingProjectIds.has(row.id))
  }

  const taskRows = (tasksResult.data ?? []) as Array<{ project_id: string | null; status: string }>
  const taskCounts = new Map<string, { total: number; completed: number }>()
  for (const t of taskRows) {
    if (!t.project_id) continue
    const c = taskCounts.get(t.project_id) ?? { total: 0, completed: 0 }
    c.total += 1
    if (t.status === 'done') c.completed += 1
    taskCounts.set(t.project_id, c)
  }
  const contacts = (contactsResult.data ?? []) as ProjectContactRow[]
  const milestones = (milestonesResult.data ?? []) as ProjectMilestone[]

  return rows.map((row) =>
    mapProjectListItem(
      row,
      taskCounts.get(row.id) ?? { total: 0, completed: 0 },
      contacts.filter((contact) => contact.project_id === row.id).flatMap((contact) =>
        firstRelation(contact.contacts) ? [firstRelation(contact.contacts) as Contact] : []
      ),
      milestones.filter((milestone) => milestone.project_id === row.id)
    )
  )
}

export async function getProjectById(
  id: string,
  client?: SupabaseClient
): Promise<ProjectDetail | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('projects')
    .select('*, workstreams(*), accounts(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load project')
  }

  if (!data) {
    return null
  }

  const [phasesResult, milestonesResult, tasks, contactsResult, enquiries] = await Promise.all([
    supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', id)
      .order('order_index', { ascending: true })
      .order('due_date', { ascending: true }),
    getTasks({ project_id: id, include_completed: true }, supabase),
    supabase
      .from('project_contacts')
      .select('contact_id, relationship_role, created_at, contacts(*)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    getEnquiries({ project_id: id }, supabase),
  ])

  const taskIds = tasks.map((task) => task.id)

  const [checklistsResult, attachmentsResult, timeLogsResult, activityResult, dependenciesResult] =
    taskIds.length > 0
      ? await Promise.all([
          supabase
            .from('task_checklists')
            .select('*')
            .in('task_id', taskIds)
            .order('order_index', { ascending: true }),
          supabase
            .from('task_attachments')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('task_time_logs')
            .select('*')
            .in('task_id', taskIds)
            .order('logged_date', { ascending: false }),
          supabase
            .from('task_activity')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false }),
          supabase
            .from('task_dependencies')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]

  if (phasesResult.error) {
    throw new Error(phasesResult.error.message || 'Failed to load project phases')
  }

  if (milestonesResult.error) {
    throw new Error(milestonesResult.error.message || 'Failed to load project milestones')
  }

  if (contactsResult.error) {
    throw new Error(contactsResult.error.message || 'Failed to load project contacts')
  }

  if (checklistsResult.error) {
    throw new Error(checklistsResult.error.message || 'Failed to load task checklists')
  }

  if (attachmentsResult.error) {
    throw new Error(attachmentsResult.error.message || 'Failed to load task attachments')
  }

  if (timeLogsResult.error) {
    throw new Error(timeLogsResult.error.message || 'Failed to load task time logs')
  }

  if (activityResult.error) {
    throw new Error(activityResult.error.message || 'Failed to load task activity')
  }

  if (dependenciesResult.error) {
    throw new Error(dependenciesResult.error.message || 'Failed to load task dependencies')
  }

  return {
    ...mapProjectRow(data as ProjectRow),
    workstream: (data as ProjectRow).workstreams,
    account: (data as ProjectRow).accounts,
    phases: (phasesResult.data ?? []) as ProjectPhase[],
    milestones: (milestonesResult.data ?? []) as ProjectMilestone[],
    tasks,
    task_checklists: (checklistsResult.data ?? []) as TaskChecklistItem[],
    task_attachments: (attachmentsResult.data ?? []) as TaskAttachment[],
    task_time_logs: (timeLogsResult.data ?? []) as TaskTimeLog[],
    task_activity: (activityResult.data ?? []) as TaskActivityEntry[],
    task_dependencies: (dependenciesResult.data ?? []) as TaskDependency[],
    contacts: ((contactsResult.data ?? []) as ProjectContactRow[]).flatMap((item) =>
      firstRelation(item.contacts) ? [firstRelation(item.contacts) as Contact] : []
    ),
    enquiries,
  }
}

export async function syncProjectScope(
  projectId: string,
  scope: QuoteScope[],
  client?: SupabaseClient
): Promise<ProjectPhase[]> {
  const supabase = await getSupabase(client)
  const phasesToSync = scope.filter((phase) => phase.phase.trim())

  const { data: existingRows, error: existingError } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (existingError) {
    throw new Error(existingError.message || 'Failed to load project phases')
  }

  const existing = (existingRows ?? []) as ProjectPhase[]

  for (let index = 0; index < phasesToSync.length; index += 1) {
    const phase = phasesToSync[index]
    const current = existing[index]
    const payload = {
      project_id: projectId,
      name: phase.phase.trim(),
      description: phase.description.trim() || null,
      sort_order: index,
      start_date: current?.start_date ?? null,
      end_date: current?.end_date ?? null,
    }

    if (current) {
      const { error } = await supabase.from('project_phases').update(payload).eq('id', current.id)

      if (error) {
        throw new Error(error.message || 'Failed to update project phase')
      }
    } else {
      const { error } = await supabase.from('project_phases').insert(payload)

      if (error) {
        throw new Error(error.message || 'Failed to create project phase')
      }
    }
  }

  const idsToDelete = existing.slice(phasesToSync.length).map((phase) => phase.id)
  if (idsToDelete.length > 0) {
    const { error } = await supabase.from('project_phases').delete().in('id', idsToDelete)

    if (error) {
      throw new Error(error.message || 'Failed to remove project phases')
    }
  }

  const { data: syncedRows, error: syncedError } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (syncedError) {
    throw new Error(syncedError.message || 'Failed to reload project phases')
  }

  return (syncedRows ?? []) as ProjectPhase[]
}

export async function createProject(
  input: CreateProjectInput,
  client?: SupabaseClient
): Promise<Project> {
  const supabase = await getSupabase(client)
  const payload = sanitizeProjectPayload(input)

  if (!payload.name) {
    throw new Error('name is required')
  }

  // workstream_id is retired (brief 19) — projects are no longer workstream-scoped.

  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...payload,
      status: input.status ?? 'planning',
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create project')
  }

  return data as Project
}

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
  client?: SupabaseClient
): Promise<Project> {
  const supabase = await getSupabase(client)
  const payload = sanitizeProjectPayload(input)

  if (payload.name !== undefined && !payload.name) {
    throw new Error('name is required')
  }

  const { data, error } = await supabase
    .from('projects')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update project')
  }

  return data as Project
}

export async function archiveProject(
  id: string,
  client?: SupabaseClient
): Promise<Project> {
  return updateProject(id, { status: 'cancelled' }, client)
}

export async function deleteProject(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete project')
  }
}

export async function listProjectsByWorkstream(
  workstreamId: string,
  client?: SupabaseClient
): Promise<ProjectListItem[]> {
  return getProjects({ workstream_id: workstreamId }, client)
}

export async function listProjectsByAccount(
  accountId: string,
  client?: SupabaseClient
): Promise<ProjectListItem[]> {
  return getProjects({ account_id: accountId }, client)
}

export async function listProjectsByContact(
  contactId: string,
  client?: SupabaseClient
): Promise<ProjectListItem[]> {
  return getProjects({ contact_id: contactId }, client)
}

export async function addContactToProject(
  projectId: string,
  contactId: string,
  relationshipRole?: string | null,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('project_contacts').upsert({
    project_id: projectId,
    contact_id: contactId,
    relationship_role: relationshipRole?.trim() || null,
  })

  if (error) {
    throw new Error(error.message || 'Failed to link contact to project')
  }
}

export async function removeContactFromProject(
  projectId: string,
  contactId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('project_contacts')
    .delete()
    .eq('project_id', projectId)
    .eq('contact_id', contactId)

  if (error) {
    throw new Error(error.message || 'Failed to unlink contact from project')
  }
}