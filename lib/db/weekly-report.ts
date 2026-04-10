import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export interface WeeklyReportData {
  weekLabel: string
  startDate: string
  endDate: string
  workstreams: WorkstreamReport[]
  taskSummary: TaskSummary
  projectSummary: ProjectSummary[]
  narrative?: string
}

export interface WorkstreamReport {
  id: string
  slug: string
  label: string
  colour: string
  openTasks: number
  completedThisWeek: number
  dueThisWeek: number
  overdue: number
}

export interface TaskSummary {
  total: number
  completed: number
  added: number
  overdue: number
  dueSoon: number
}

export interface ProjectSummary {
  id: string
  name: string
  workstream_label: string | null
  workstream_colour: string | null
  status: string
  task_count: number
  completed_task_count: number
  next_milestone: string | null
}

function getWeekRange(date: Date = new Date()): { start: string; end: string; label: string } {
  const d = new Date(date)
  const day = d.getDay()
  // Start on Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10)
  const monthFmt = (dt: Date) =>
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return {
    start: fmt(monday),
    end: fmt(sunday),
    label: `${monthFmt(monday)} – ${monthFmt(sunday)} ${monday.getFullYear()}`,
  }
}

export async function getWeeklyReportData(
  client?: SupabaseClient
): Promise<WeeklyReportData> {
  const supabase = client ?? (await createClient())
  const { start, end, label } = getWeekRange()
  const today = new Date().toISOString().slice(0, 10)

  // Parallel queries
  const [
    workstreamsResult,
    openTasksResult,
    completedThisWeekResult,
    addedThisWeekResult,
    overdueResult,
    dueSoonResult,
    projectsResult,
  ] = await Promise.all([
    supabase.from('workstreams').select('id, slug, label, colour, sort_order').order('sort_order'),

    supabase
      .from('tasks')
      .select('id, workstream_id')
      .is('completed_at', null),

    supabase
      .from('tasks')
      .select('id, workstream_id')
      .gte('completed_at', `${start}T00:00:00`)
      .lte('completed_at', `${end}T23:59:59`),

    supabase
      .from('tasks')
      .select('id')
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`),

    supabase
      .from('tasks')
      .select('id, workstream_id')
      .is('completed_at', null)
      .lt('due_date', today),

    supabase
      .from('tasks')
      .select('id')
      .is('completed_at', null)
      .gte('due_date', today)
      .lte('due_date', end),

    supabase
      .from('projects')
      .select('id, name, workstream_id, status, workstreams(label, colour)')
      .in('status', ['active', 'in_progress', 'planning'])
      .order('created_at', { ascending: false }),
  ])

  const workstreams = workstreamsResult.data ?? []
  const openTasks = openTasksResult.data ?? []
  const completedTasks = completedThisWeekResult.data ?? []
  const addedTasks = addedThisWeekResult.data ?? []
  const overdueTasks = overdueResult.data ?? []
  const dueSoonTasks = dueSoonResult.data ?? []
  const projects = projectsResult.data ?? []

  // Build per-workstream counts
  const workstreamReports: WorkstreamReport[] = workstreams.map((ws) => {
    const wsOpen = openTasks.filter((t) => t.workstream_id === ws.id)
    const wsCompleted = completedTasks.filter((t) => t.workstream_id === ws.id)
    const wsDue = wsOpen.filter((t) => {
      // tasks with due_date in this week - need separate query, approximate with overdue count
      return false
    })
    const wsOverdue = overdueTasks.filter((t) => t.workstream_id === ws.id)

    return {
      id: ws.id,
      slug: ws.slug,
      label: ws.label,
      colour: ws.colour,
      openTasks: wsOpen.length,
      completedThisWeek: wsCompleted.length,
      dueThisWeek: 0, // filled below
      overdue: wsOverdue.length,
    }
  })

  // Get due-this-week per workstream
  const dueThisWeekResult = await supabase
    .from('tasks')
    .select('id, workstream_id')
    .is('completed_at', null)
    .gte('due_date', start)
    .lte('due_date', end)

  const dueThisWeekTasks = dueThisWeekResult.data ?? []
  for (const ws of workstreamReports) {
    ws.dueThisWeek = dueThisWeekTasks.filter((t) => t.workstream_id === ws.id).length
  }

  // Project summaries — count tasks per project
  const projectIds = projects.map((p) => p.id)
  let projectTaskCounts: Record<string, { total: number; completed: number }> = {}

  if (projectIds.length > 0) {
    const [totalResult, completedResult] = await Promise.all([
      supabase.from('tasks').select('project_id').in('project_id', projectIds),
      supabase.from('tasks').select('project_id').in('project_id', projectIds).not('completed_at', 'is', null),
    ])

    const totalTasks = totalResult.data ?? []
    const completedProjectTasks = completedResult.data ?? []

    for (const pid of projectIds) {
      projectTaskCounts[pid] = {
        total: totalTasks.filter((t) => t.project_id === pid).length,
        completed: completedProjectTasks.filter((t) => t.project_id === pid).length,
      }
    }
  }

  // Get next milestone for each project
  const milestonesResult = projectIds.length > 0
    ? await supabase
        .from('project_milestones')
        .select('project_id, title, due_date')
        .in('project_id', projectIds)
        .is('completed_at', null)
        .order('due_date', { ascending: true })
    : { data: [] }

  const milestones = milestonesResult.data ?? []
  const nextMilestoneMap: Record<string, string> = {}
  for (const m of milestones) {
    if (m.project_id && !nextMilestoneMap[m.project_id]) {
      nextMilestoneMap[m.project_id] = m.title
    }
  }

  const projectSummary: ProjectSummary[] = projects.map((p) => {
    const ws = (p.workstreams as unknown as { label: string; colour: string }[] | null)?.[0] ?? null
    return {
      id: p.id,
      name: p.name,
      workstream_label: ws?.label ?? null,
      workstream_colour: ws?.colour ?? null,
      status: p.status,
      task_count: projectTaskCounts[p.id]?.total ?? 0,
      completed_task_count: projectTaskCounts[p.id]?.completed ?? 0,
      next_milestone: nextMilestoneMap[p.id] ?? null,
    }
  })

  return {
    weekLabel: label,
    startDate: start,
    endDate: end,
    workstreams: workstreamReports,
    taskSummary: {
      total: openTasks.length,
      completed: completedTasks.length,
      added: addedTasks.length,
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length,
    },
    projectSummary,
  }
}
