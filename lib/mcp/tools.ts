import { z } from 'zod'
import { getCoworkBriefing } from '@/lib/cowork-briefing'
import {
  bulkCreateEngagementTasks,
  listProjectEngagementTasks,
  updateEngagementTask,
} from '@/lib/db/engagement-tasks'
import { addNote } from '@/lib/db/notes'
import { getProjectById, getProjects } from '@/lib/db/projects'
import type { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import {
  ACCOUNT_SELECT,
  accountCounts,
  findAccountByExactName,
  formatAccount,
  optionalString,
  parseAccountStatus,
} from '@/lib/cowork-api'
import {
  addTier1,
  engagementMonthUsage,
  getEngagementDetail,
  getEngagementRow,
  getMilestones,
  listEngagementDocuments,
  listEngagements as listEngagementsFn,
  logTime,
  raiseMilestoneInvoiceByAccount,
  setMilestone,
  uploadEngagementDocument,
} from '@/lib/cowork-engagements'
import { createCoworkInvoice, listCoworkInvoices, setInvoiceStatus } from '@/lib/cowork-invoices'
import { getCampaignDetail, listCampaigns } from '@/lib/cowork-outreach'
import { listCoworkActivity, recordCoworkWrite } from '@/lib/cowork-audit'
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

export const listProjects = defineTool({
  name: 'list_projects',
  description:
    'List projects, optionally filtered by status. Returns summary rows with task counts and next milestone.',
  inputSchema: z.object({
    status: projectStatus.optional(),
  }),
  handler: async (input) =>
    getProjects({ status: input.status as ProjectStatus | undefined }, db),
})

export const getProject = defineTool({
  name: 'get_project',
  description:
    'Get one project by id with its phases, milestones, and counts (tasks, completed tasks, contacts).',
  inputSchema: z.object({
    id: z.string().min(1).optional(),
    project_id: z.string().min(1).optional(),
  }),
  handler: async (input) => {
    const projectId = input.id ?? input.project_id
    if (!projectId) throw new Error('id (or project_id) is required')
    const project = await getProjectById(projectId, db)
    if (!project) throw new Error(`Project not found: ${projectId}`)
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

export const updateEngagementTaskTool = defineTool({
  name: 'update_engagement_task',
  description:
    'Patch an engagement task (ticket board). Supply only the fields to change: title, description, status, priority, due_date, labels, position.',
  inputSchema: z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    status: engagementTaskStatus.optional(),
    priority: engagementTaskPriority.optional(),
    due_date: isoDate.nullable().optional(),
    labels: z.array(z.string()).optional(),
    position: z.number().optional(),
  }),
  handler: async (input) => {
    const { id, ...patch } = input
    return updateEngagementTask(
      id,
      {
        title: patch.title,
        description: patch.description,
        status: patch.status as never,
        priority: patch.priority as never,
        due_date: patch.due_date,
        labels: patch.labels,
        position: patch.position,
      },
      db
    )
  },
})

export const addNoteTool = defineTool({
  name: 'add_note',
  description:
    'Add a note attached to a task. Provide a task_id, plus a title and/or body.',
  inputSchema: z.object({
    task_id: z.string().min(1),
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  handler: async (input) =>
    addNote(
      {
        task_id: input.task_id,
        title: input.title,
        body: input.body,
      },
      db
    ),
})

export const briefing = defineTool({
  name: 'briefing',
  description:
    "Today's brief: tasks (due today / overdue / due this week), calendar events, new enquiries, and invoice totals.",
  inputSchema: z.object({}),
  handler: async () => getCoworkBriefing(),
})

// ── Engagements / time / milestones / invoices (delegate to shared modules) ───

const engagementRef = z.string().min(1) // uuid or code

export const listEngagementsTool = defineTool({
  name: 'list_engagements',
  description: 'Active engagements with hours used this month and billing position. Filter by status/account.',
  inputSchema: z.object({ status: z.string().optional(), account: z.string().optional(), limit: z.number().optional() }),
  handler: async (input) => listEngagementsFn({ status: input.status as never, accountId: undefined, limit: input.limit }),
})

export const getEngagementTool = defineTool({
  name: 'get_engagement',
  description: 'Full engagement detail (hours, tier-1, billing, contributors, projects). Accepts the code or the uuid.',
  inputSchema: z.object({ id: engagementRef }),
  handler: async (input) => getEngagementDetail(input.id),
})

export const logTimeTool = defineTool({
  name: 'log_time',
  description: 'Log completed time against an engagement, project or delivery ticket (engagement_tasks). Pass task_id to attribute the entry to a ticket — the engagement and project are derived from the ticket automatically (a task_id whose engagement conflicts with an explicit engagement_id is rejected). Snapshots a rate; warns if it takes the engagement past its monthly cap. e.g. "log 90 minutes on the Bestway pitch".',
  inputSchema: z.object({
    engagement_id: z.string().optional(),
    project_id: z.string().optional(),
    task_id: z.string().optional(),
    account_id: z.string().optional(),
    duration_minutes: z.number().int().positive(),
    entry_date: isoDate.optional(),
    description: z.string().nullable().optional(),
    billable: z.boolean().optional(),
    rate_snapshot: z.number().optional(),
  }),
  handler: async (input) => {
    const { entry, warning } = await logTime(input as Record<string, unknown>)
    const label = entry.engagement?.code ?? entry.project?.name ?? entry.account?.name ?? 'general'
    void recordCoworkWrite({
      action: 'create', entity: 'time_entry', entityId: entry.id, entityLabel: `${entry.hours}h on ${label}`,
      engagementId: entry.engagement?.id ?? null,
      summary: `Logged ${entry.hours}h on ${label} at £${entry.rate_snapshot}/h${warning ? ` — over cap by ${warning.over_by_hours}h` : ''}`,
      payload: input as Record<string, unknown>,
    })
    return warning ? { ...entry, warning } : entry
  },
})

export const setMilestoneGateTool = defineTool({
  name: 'set_milestone_gate',
  description: 'Set or clear a Tier 1 gate (range_review_decided | go_live_confirmed | first_po_received) for an account on an engagement. e.g. "Booker range review decided today". Pass date:null to clear.',
  inputSchema: z.object({
    engagement: engagementRef,
    account_id: z.string().optional(),
    account_name: z.string().optional(),
    gate: z.enum(['range_review_decided', 'go_live_confirmed', 'first_po_received']),
    date: isoDate.nullable(),
  }),
  handler: async (input) => {
    const engagement = await getEngagementRow(input.engagement)
    let accountId = input.account_id
    if (!accountId && input.account_name) {
      const acc = await findAccountByExactName(input.account_name)
      if (!acc) throw new Error(`Account not found: ${input.account_name}`)
      accountId = acc.id
    }
    if (!accountId) throw new Error('account_id or account_name is required')
    const prior = (await getMilestones(input.engagement)).find((m) => m.account_id === accountId)
    const milestone = await setMilestone(input.engagement, accountId, { gate: input.gate, date: input.date })
    void recordCoworkWrite({
      action: 'update', entity: 'tier1_milestone', entityId: milestone.id,
      entityLabel: `${milestone.account?.name ?? 'account'} — Tier 1`, engagementId: engagement.id,
      summary: `Set ${input.gate} for ${milestone.account?.name ?? 'an account'} on ${engagement.name}${milestone.is_complete ? ' — all three gates now complete' : ''}`,
      before: {
        range_review_decided_at: prior?.range_review_decided_at ?? null,
        go_live_confirmed_at: prior?.go_live_confirmed_at ?? null,
        first_po_received_at: prior?.first_po_received_at ?? null,
      },
      payload: input as Record<string, unknown>,
    })
    return milestone
  },
})

export const raiseListingInvoiceTool = defineTool({
  name: 'raise_listing_invoice',
  description: 'Raise the Tier 1 performance-fee invoice from a completed milestone (engagement + account).',
  inputSchema: z.object({ engagement: engagementRef, account_id: z.string().min(1) }),
  handler: async (input) => {
    const engagement = await getEngagementRow(input.engagement)
    const invoice = await raiseMilestoneInvoiceByAccount(input.engagement, input.account_id)
    const fee = invoice.line_items?.[0]?.unit_price ?? 0
    void recordCoworkWrite({
      action: 'create', entity: 'invoice', entityId: invoice.id, entityLabel: invoice.invoice_number, engagementId: engagement.id,
      summary: `Raised ${invoice.invoice_number}, £${Number(fee).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Tier 1 listing fee, ${engagement.name}`,
      payload: input as Record<string, unknown>,
    })
    return invoice
  },
})

export const listInvoicesTool = defineTool({
  name: 'list_invoices',
  description: 'List invoices, filterable by status and engagement. Excludes soft-deleted.',
  inputSchema: z.object({ status: z.string().optional(), engagement: z.string().optional(), limit: z.number().optional() }),
  handler: async (input) => {
    const engagementId = input.engagement ? (await getEngagementRow(input.engagement)).id : null
    return listCoworkInvoices({ status: input.status, engagementId, limit: input.limit })
  },
})

export const raiseInvoiceTool = defineTool({
  name: 'raise_invoice',
  description: 'Create a retainer/overage invoice. line_items:[{description,qty,unit_price}]; engagement_id links it and defaults the account.',
  inputSchema: z.object({
    line_items: z.array(z.object({ description: z.string(), qty: z.number(), unit_price: z.number() })).min(1),
    engagement_id: z.string().optional(),
    account_name: z.string().optional(),
    status: z.enum(['draft', 'sent']).optional(),
    due_date: isoDate.optional(),
    vat_rate: z.number().optional(),
    notes: z.string().optional(),
  }),
  handler: async (input) => {
    const { invoice, engagement } = await createCoworkInvoice(input as Record<string, unknown>)
    const gbp = `£${invoice.total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    void recordCoworkWrite({
      action: 'create', entity: 'invoice', entityId: invoice.id, entityLabel: invoice.invoice_number, engagementId: engagement?.id ?? null,
      summary: `Raised ${invoice.status} invoice ${invoice.invoice_number}, ${gbp}, ${invoice.title}${invoice.account ? `, ${invoice.account.name}` : ''}${engagement ? ` (${engagement.name})` : ''}`,
      payload: input as Record<string, unknown>,
    })
    return invoice
  },
})

export const markInvoicePaidTool = defineTool({
  name: 'mark_invoice_paid',
  description: 'Mark an invoice paid (or set another status). id is the invoice uuid.',
  inputSchema: z.object({ id: z.string().min(1), status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional() }),
  handler: async (input) => {
    const { invoice, before } = await setInvoiceStatus(input.id, input.status ?? 'paid')
    void recordCoworkWrite({
      action: 'update', entity: 'invoice', entityId: invoice.id, entityLabel: invoice.invoice_number,
      summary: `Marked invoice ${invoice.invoice_number} ${invoice.status} (was ${before.status})`,
      before, payload: { status: invoice.status },
    })
    return invoice
  },
})

export const findAccountTool = defineTool({
  name: 'find_account',
  description: 'Find an account by exact (case-insensitive) name. Returns the row or null — use before creating to avoid duplicates.',
  inputSchema: z.object({ name: z.string().min(1) }),
  handler: async (input) => {
    const acc = await findAccountByExactName(input.name)
    if (!acc) return null
    const { contacts, openTasks } = await accountCounts([acc.id])
    return formatAccount(acc as never, { contacts: contacts.get(acc.id) ?? 0, open_tasks: openTasks.get(acc.id) ?? 0 })
  },
})

export const createAccountTool = defineTool({
  name: 'create_account',
  description: 'Create an account, duplicate-safe: on a name match it returns the existing row (existing:true) and creates nothing.',
  inputSchema: z.object({
    name: z.string().min(1),
    website: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    status: z.string().optional(),
    channel: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }),
  handler: async (input) => {
    const existing = await findAccountByExactName(input.name)
    if (existing) {
      const { contacts, openTasks } = await accountCounts([existing.id])
      return { existing: true, account: formatAccount(existing as never, { contacts: contacts.get(existing.id) ?? 0, open_tasks: openTasks.get(existing.id) ?? 0 }) }
    }
    const { data, error } = await supabaseService
      .from('accounts')
      .insert({
        name: input.name,
        website: optionalString(input.website),
        industry: optionalString(input.industry),
        status: parseAccountStatus(input.status),
        channel: optionalString(input.channel),
        notes: optionalString(input.notes),
      })
      .select(ACCOUNT_SELECT)
      .single()
    if (error) throw new Error(error.message || 'Failed to create account')
    const account = formatAccount(data as never, { contacts: 0, open_tasks: 0 })
    void recordCoworkWrite({
      action: 'create', entity: 'account', entityId: account.id, entityLabel: account.name,
      summary: `Created account "${account.name}"`, payload: input as Record<string, unknown>,
    })
    return { existing: false, account }
  },
})

export const addTier1AccountTool = defineTool({
  name: 'add_tier1_account',
  description: 'Attach a target account to an engagement as a Tier 1 listing. account_name with create_if_missing creates it.',
  inputSchema: z.object({
    engagement: engagementRef,
    account_id: z.string().optional(),
    account_name: z.string().optional(),
    create_if_missing: z.boolean().optional(),
    notes: z.string().optional(),
  }),
  handler: async (input) => {
    const engagement = await getEngagementRow(input.engagement)
    const tier1 = await addTier1(input.engagement, input as Record<string, unknown>)
    void recordCoworkWrite({
      action: 'create', entity: 'tier1_account', engagementId: engagement.id,
      summary: `Attached a Tier 1 target account to ${engagement.name} (${tier1.length} tracked)`, payload: input as Record<string, unknown>,
    })
    return tier1
  },
})

export const listOutreachCampaignsTool = defineTool({
  name: 'list_outreach_campaigns',
  description: 'List outreach campaigns with their stats (pipeline reporting).',
  inputSchema: z.object({}),
  handler: async () => listCampaigns(),
})

export const getCampaignStatsTool = defineTool({
  name: 'get_campaign_stats',
  description: 'Campaign stats: sends/deliveries/opens/replies, per-recipient status counts, recent replies. id is the campaign uuid.',
  inputSchema: z.object({ id: z.string().min(1) }),
  handler: async (input) => getCampaignDetail(input.id),
})

export const engagementHoursCheckTool = defineTool({
  name: 'engagement_hours_check',
  description: 'Hours used vs included for an engagement this month (or a given YYYY-MM month).',
  inputSchema: z.object({ engagement: engagementRef, month: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  handler: async (input) => {
    if (!input.month) return engagementMonthUsage(input.engagement)
    const e = await getEngagementRow(input.engagement)
    const period = `${input.month}-01`
    const { data } = await supabaseService.from('engagement_hours_by_month').select('*').eq('engagement_id', e.id).eq('period_month', period).maybeSingle()
    const row = data as { hours_used?: number | string; billable_hours?: number | string } | null
    const used = Number(row?.hours_used ?? 0)
    return { engagement_id: e.id, month: input.month, used, included: e.included_hours_monthly, over: used - (e.included_hours_monthly ?? 0) }
  },
})

export const uploadEngagementDocumentTool = defineTool({
  name: 'upload_engagement_document',
  description: 'Upload a document to an engagement. Provide file_name plus content_base64 (any file) or content (utf-8 text, e.g. a markdown note). Optional title and mime_type.',
  inputSchema: z.object({
    engagement: engagementRef,
    file_name: z.string().min(1),
    content_base64: z.string().optional(),
    content: z.string().optional(),
    title: z.string().optional(),
    mime_type: z.string().optional(),
  }),
  handler: async (input) => {
    const { document, engagement } = await uploadEngagementDocument(input.engagement, input as Record<string, unknown>)
    void recordCoworkWrite({
      action: 'create', entity: 'engagement_document', entityId: document.id, entityLabel: document.file_name, engagementId: engagement.id,
      summary: `Uploaded document "${document.title ?? document.file_name}" to ${engagement.name}`,
      payload: { file_name: document.file_name, mime_type: document.mime_type, size_bytes: document.size_bytes },
    })
    return document
  },
})

export const listEngagementDocumentsTool = defineTool({
  name: 'list_engagement_documents',
  description: 'List documents on an engagement (uploaded files and markdown docs).',
  inputSchema: z.object({ engagement: engagementRef }),
  handler: async (input) => listEngagementDocuments(input.engagement),
})

export const recentCoworkActivityTool = defineTool({
  name: 'recent_cowork_activity',
  description: 'Recent Cowork writes (the change log), newest first. Filter by engagement/entity.',
  inputSchema: z.object({ engagement: z.string().optional(), entity: z.string().optional(), limit: z.number().optional() }),
  handler: async (input) => {
    const engagementId = input.engagement ? (await getEngagementRow(input.engagement)).id : undefined
    return listCoworkActivity({ engagementId, entity: input.entity, limit: input.limit })
  },
})

export const tools: McpTool[] = [
  whoami,
  listProjects,
  getProject,
  listEngagementTasks,
  bulkCreateEngagementTasksTool,
  updateEngagementTaskTool,
  addNoteTool,
  briefing,
  listEngagementsTool,
  getEngagementTool,
  logTimeTool,
  setMilestoneGateTool,
  raiseListingInvoiceTool,
  listInvoicesTool,
  raiseInvoiceTool,
  markInvoicePaidTool,
  findAccountTool,
  createAccountTool,
  addTier1AccountTool,
  listOutreachCampaignsTool,
  getCampaignStatsTool,
  engagementHoursCheckTool,
  uploadEngagementDocumentTool,
  listEngagementDocumentsTool,
  recentCoworkActivityTool,
]
