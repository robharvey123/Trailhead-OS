import { z } from 'zod'
import { getWorkstreamBySlug } from '@/lib/cowork-api'
import { getCoworkBriefing } from '@/lib/cowork-briefing'
import {
  completeCoworkTask,
  createCoworkTask,
  listCoworkTasks,
  updateCoworkTask,
} from '@/lib/cowork-tasks'
import {
  bulkCreateEngagementTasks,
  listProjectEngagementTasks,
} from '@/lib/db/engagement-tasks'
import { addNote } from '@/lib/db/notes'
import { getProjectById, getProjects } from '@/lib/db/projects'
import type { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import {
  ENGAGEMENT_TASK_PRIORITIES,
  ENGAGEMENT_TASK_STATUSES,
  type ProjectStatus,
} from '@/lib/types'

/**
 * MCP tool layer for Trailhead OS. Each tool is a thin adapter over the existing
 * Cowork helpers (`lib/cowork-*.ts`) and `lib/db/*` modules — no business logic
 * lives here. Handlers throw on validation/IO failure; the MCP route wraps thrown
 * errors into tool error responses (do not catch-and-return-ok).
 *
 * Trailhead OS is single-user, so there is no org/user scoping. All DB access
 * runs through the service-role client (same as the Cowork REST API).
 */

// The `lib/db/*` helpers default to the cookie-scoped RLS client but accept an
// optional client. MCP has no user session, so we hand them the service client.
// The two clients are structurally the same SupabaseClient class; this single
// documented cast bridges the (untyped) generics.
type DbClient = Awaited<ReturnType<typeof createServerClient>>
const db = supabaseService as unknown as DbClient

// ── Shared enums (kept in sync with lib/types.ts and the Cowork API) ──────────

// The fixed workstreams (the 5 in CLAUDE.md plus the live `personal` stream).
// getWorkstreamBySlug still validates, but the enum makes the surface
// self-describing to Claude.
const WORKSTREAM_SLUGS = [
  'brand-sales',
  'ecommerce',
  'app-dev',
  'mvp-cricket',
  'consulting',
  'personal',
] as const
const workstreamSlug = z.enum(WORKSTREAM_SLUGS)

// OS task priorities accepted by the Cowork API (note: not the full TaskPriority
// union — 'critical' is not accepted by the REST contract, so we mirror it).
const osTaskPriority = z.enum(['low', 'medium', 'high', 'urgent'])
const taskColumn = z.enum(['backlog', 'in-progress', 'review', 'done'])
const taskDueFilter = z.enum(['today', 'overdue', 'this_week', 'all'])
const projectStatus = z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
const engagementTaskStatus = z.enum(ENGAGEMENT_TASK_STATUSES as [string, ...string[]])
const engagementTaskPriority = z.enum(ENGAGEMENT_TASK_PRIORITIES as [string, ...string[]])
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')

// ── Tool registry types ───────────────────────────────────────────────────────

export interface McpTool {
  name: string
  description: string
  inputSchema: z.ZodTypeAny
  handler: (input: unknown) => Promise<unknown>
}

/**
 * Build a tool from a typed config. The stored handler validates its input with
 * the schema before delegating, so a thrown ZodError surfaces as a tool error.
 */
function defineTool<S extends z.ZodTypeAny, O>(config: {
  name: string
  description: string
  inputSchema: S
  handler: (input: z.infer<S>) => Promise<O>
}): McpTool {
  return {
    name: config.name,
    description: config.description,
    inputSchema: config.inputSchema,
    handler: async (input: unknown) => config.handler(config.inputSchema.parse(input)),
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

export const whoami = defineTool({
  name: 'whoami',
  description:
    'Returns server identity and version. Use to confirm the MCP connection is healthy.',
  inputSchema: z.object({}),
  handler: async () => ({
    server: 'trailhead-os',
    version: '1.0.0',
    status: 'ok',
    message: 'Trailhead OS MCP v1, ok',
    identity: 'cowork-token',
  }),
})

export const listWorkstreams = defineTool({
  name: 'list_workstreams',
  description: 'List the five fixed Trailhead OS workstreams (id, slug, label, colour).',
  inputSchema: z.object({}),
  handler: async () => {
    const { data, error } = await supabaseService
      .from('workstreams')
      .select('id, slug, label, colour, sort_order')
      .order('sort_order', { ascending: true })
    if (error) throw new Error(error.message || 'Failed to load workstreams')
    return data ?? []
  },
})

export const listProjects = defineTool({
  name: 'list_projects',
  description:
    'List projects, optionally filtered by workstream slug and/or status. Returns summary rows with task counts and next milestone.',
  inputSchema: z.object({
    workstream: workstreamSlug.optional(),
    status: projectStatus.optional(),
  }),
  handler: async (input) => {
    const workstream = input.workstream ? await getWorkstreamBySlug(input.workstream) : null
    return getProjects(
      {
        workstream_id: workstream?.id,
        status: input.status as ProjectStatus | undefined,
      },
      db
    )
  },
})

export const getProject = defineTool({
  name: 'get_project',
  description:
    'Get one project by id with its phases, milestones, and counts (tasks, completed tasks, contacts).',
  inputSchema: z.object({
    id: z.string().min(1),
  }),
  handler: async (input) => {
    const project = await getProjectById(input.id, db)
    if (!project) throw new Error(`Project not found: ${input.id}`)
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      workstream: project.workstream
        ? { slug: project.workstream.slug, label: project.workstream.label }
        : null,
      account: project.account ? { id: project.account.id, name: project.account.name } : null,
      brief: project.brief,
      description: project.description,
      start_date: project.start_date,
      end_date: project.end_date,
      estimated_end_date: project.estimated_end_date,
      ai_planned: project.ai_planned,
      phases: project.phases.map((phase) => ({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        sort_order: phase.sort_order,
        start_date: phase.start_date,
        end_date: phase.end_date,
      })),
      milestones: project.milestones.map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        date: milestone.date,
        completed: milestone.completed,
      })),
      counts: {
        tasks: project.tasks.length,
        completed_tasks: project.tasks.filter((task) => Boolean(task.completed_at)).length,
        phases: project.phases.length,
        milestones: project.milestones.length,
        contacts: project.contacts.length,
      },
    }
  },
})

export const listTasks = defineTool({
  name: 'list_tasks',
  description:
    'List OS kanban tasks (the `tasks` table). Filter by workstream slug, project_id, priority, due window, and master-todo flag.',
  inputSchema: z.object({
    workstream: workstreamSlug.optional(),
    project_id: z.string().optional(),
    priority: osTaskPriority.optional(),
    due: taskDueFilter.optional(),
    master: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  handler: async (input) =>
    listCoworkTasks({
      workstreamSlug: input.workstream ?? null,
      projectId: input.project_id ?? null,
      priority: input.priority ?? null,
      due: input.due,
      master: input.master,
      limit: input.limit,
    }),
})

export const createTask = defineTool({
  name: 'create_task',
  description:
    'Create a single OS task in the given workstream (lands in Backlog). Returns the created task.',
  inputSchema: z.object({
    title: z.string().min(1),
    workstream: workstreamSlug,
    priority: osTaskPriority.optional(),
    due_date: isoDate.optional(),
    start_date: isoDate.optional(),
    description: z.string().optional(),
    is_master_todo: z.boolean().optional(),
    project_id: z.string().optional(),
    contact_id: z.string().optional(),
    account_id: z.string().optional(),
  }),
  handler: async (input) => createCoworkTask(input),
})

export const updateTask = defineTool({
  name: 'update_task',
  description:
    'Patch an OS task. Supply only the fields to change: title, description, priority, due/start date, master flag, completed_at (ISO), or board column.',
  inputSchema: z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    priority: osTaskPriority.optional(),
    due_date: isoDate.nullable().optional(),
    start_date: isoDate.nullable().optional(),
    is_master_todo: z.boolean().optional(),
    completed_at: z.string().nullable().optional(),
    column: taskColumn.optional(),
  }),
  handler: async (input) => {
    const { id, ...patch } = input
    return updateCoworkTask(id, patch)
  },
})

export const completeTask = defineTool({
  name: 'complete_task',
  description: 'Mark an OS task done: stamps completed_at and moves it to the Done column.',
  inputSchema: z.object({
    id: z.string().min(1),
  }),
  handler: async (input) => completeCoworkTask(input.id),
})

export const listEngagementTasks = defineTool({
  name: 'list_engagement_tasks',
  description:
    'List engagement_tasks (the ticket board) scoped to one project, optionally filtered by status and/or priority.',
  inputSchema: z.object({
    project_id: z.string().min(1),
    status: engagementTaskStatus.optional(),
    priority: engagementTaskPriority.optional(),
  }),
  handler: async (input) =>
    listProjectEngagementTasks(
      input.project_id,
      {
        status: input.status as never,
        priority: input.priority as never,
      },
      db
    ),
})

export const bulkCreateEngagementTasksTool = defineTool({
  name: 'bulk_create_engagement_tasks',
  description:
    'Insert many engagement_tasks against one project in a single call — for importing a roadmap from Claude. Tasks inherit the project’s engagement.',
  inputSchema: z.object({
    project_id: z.string().min(1),
    tasks: z
      .array(
        z.object({
          title: z.string().min(1),
          description: z.string().nullable().optional(),
          status: engagementTaskStatus.optional(),
          priority: engagementTaskPriority.optional(),
          due_date: isoDate.nullable().optional(),
          labels: z.array(z.string()).optional(),
        })
      )
      .min(1)
      .max(200),
  }),
  handler: async (input) =>
    bulkCreateEngagementTasks(
      input.project_id,
      input.tasks.map((task) => ({
        title: task.title,
        description: task.description,
        status: task.status as never,
        priority: task.priority as never,
        due_date: task.due_date,
        labels: task.labels,
      })),
      db
    ),
})

export const addNoteTool = defineTool({
  name: 'add_note',
  description:
    'Add a note attached to a workstream and/or a task. (Project-scoped notes are not supported — the notes table has no project_id.) Provide a workstream slug or a task_id, plus a title and/or body.',
  inputSchema: z.object({
    workstream: workstreamSlug.optional(),
    task_id: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  handler: async (input) => {
    const workstream = input.workstream ? await getWorkstreamBySlug(input.workstream) : null
    return addNote(
      {
        workstream_id: workstream?.id ?? null,
        task_id: input.task_id ?? null,
        title: input.title,
        body: input.body,
      },
      db
    )
  },
})

export const briefing = defineTool({
  name: 'briefing',
  description:
    "Today's brief: tasks (due today / overdue / due this week), calendar events, new enquiries, and invoice totals.",
  inputSchema: z.object({}),
  handler: async () => getCoworkBriefing(),
})

export const tools: McpTool[] = [
  whoami,
  listWorkstreams,
  listProjects,
  getProject,
  listTasks,
  createTask,
  updateTask,
  completeTask,
  listEngagementTasks,
  bulkCreateEngagementTasksTool,
  addNoteTool,
  briefing,
]
