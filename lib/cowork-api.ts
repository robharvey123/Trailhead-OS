import { NextResponse } from 'next/server'
import { sendInvoicePaidNotification } from '@/lib/stripe/notifications'
import { supabaseService } from '@/lib/supabase/service'
import { calculateTotals, type InvoiceStatus, type LineItem, type TaskPriority } from '@/lib/types'

const TASK_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const CONTACT_STATUSES = new Set(['lead', 'active', 'inactive', 'archived'])
const ENQUIRY_STATUSES = new Set(['new', 'reviewed', 'converted'])
const INVOICE_STATUSES = new Set<InvoiceStatus>(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
const PROJECT_STATUSES = new Set(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
const COWORK_COLUMNS = {
  backlog: 'Backlog',
  'in-progress': 'In progress',
  review: 'Review',
  done: 'Done',
} as const

type CoworkColumnKey = keyof typeof COWORK_COLUMNS
type RelationValue<T> = T | T[] | null

type WorkstreamShape = {
  id: string
  slug: string
  label: string
}

type NamedRelation = {
  id: string
  name: string
}

type TaskRow = {
  id: string
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  start_date: string | null
  completed_at: string | null
  is_master_todo: boolean
  workstream_id: string | null
  project_id: string | null
  column_id: string | null
  contact_id: string | null
  account_id: string | null
  created_at: string
  updated_at: string
  workstreams?: RelationValue<WorkstreamShape>
  projects?: RelationValue<NamedRelation>
  board_columns?: RelationValue<{ label: string }>
  contacts?: RelationValue<NamedRelation>
  accounts?: RelationValue<NamedRelation>
}

type CalendarEventRow = {
  id: string
  title: string
  start_at: string
  end_at: string
  all_day: boolean
  location: string | null
  description: string | null
  colour: string | null
  workstream_id: string | null
  created_at: string
  updated_at: string
  workstreams?: RelationValue<WorkstreamShape>
  gcal_sync?: RelationValue<{ id: string }>
}

type ContactRow = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  role: string | null
  workstream_id: string | null
  account_id: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  workstreams?: RelationValue<WorkstreamShape>
  accounts?: RelationValue<NamedRelation>
}

type InvoiceRow = {
  id: string
  invoice_number: string
  account_id: string | null
  contact_id: string | null
  workstream_id: string | null
  pricing_tier_id: string | null
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  line_items: LineItem[] | null
  vat_rate: number | string | null
  notes: string | null
  stripe_payment_link: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
  accounts?: RelationValue<NamedRelation>
  contacts?: RelationValue<NamedRelation>
  workstreams?: RelationValue<WorkstreamShape>
  pricing_tiers?: RelationValue<{ id: string; slug: string; name: string }>
}

type EnquiryRow = {
  id: string
  biz_name: string
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  biz_type: string | null
  project_type: string | null
  top_features: string[] | null
  pain_points: string | null
  timeline: string | null
  budget: string | null
  status: string
  created_at: string
}

type ProjectRow = {
  id: string
  name: string
  description: string | null
  brief: string | null
  status: string
  workstream_id: string
  account_id: string | null
  pricing_tier_id: string | null
  start_date: string | null
  end_date: string | null
  estimated_end_date: string | null
  ai_planned: boolean
  created_at: string
  updated_at: string
  workstreams?: RelationValue<WorkstreamShape>
  accounts?: RelationValue<NamedRelation>
  pricing_tiers?: RelationValue<{ id: string; slug: string; name: string }>
}

export const TASK_SELECT = `
  id,
  title,
  description,
  priority,
  due_date,
  start_date,
  completed_at,
  is_master_todo,
  workstream_id,
  project_id,
  column_id,
  contact_id,
  account_id,
  created_at,
  updated_at,
  workstreams(id, slug, label),
  projects(id, name),
  board_columns(label),
  contacts(id, name),
  accounts(id, name)
`

export const CALENDAR_EVENT_SELECT = `
  id,
  title,
  start_at,
  end_at,
  all_day,
  location,
  description,
  colour,
  workstream_id,
  created_at,
  updated_at,
  workstreams(id, slug, label),
  gcal_sync(id)
`

export const CONTACT_SELECT = `
  id,
  name,
  company,
  email,
  phone,
  role,
  workstream_id,
  account_id,
  status,
  notes,
  created_at,
  updated_at,
  workstreams(id, slug, label),
  accounts(id, name)
`

export const INVOICE_SELECT = `
  id,
  invoice_number,
  account_id,
  contact_id,
  workstream_id,
  pricing_tier_id,
  status,
  issue_date,
  due_date,
  line_items,
  vat_rate,
  notes,
  stripe_payment_link,
  paid_at,
  created_at,
  updated_at,
  accounts(id, name),
  contacts(id, name),
  workstreams(id, slug, label),
  pricing_tiers(id, slug, name)
`

export const PROJECT_SELECT = `
  id,
  name,
  description,
  brief,
  status,
  workstream_id,
  account_id,
  pricing_tier_id,
  start_date,
  end_date,
  estimated_end_date,
  ai_planned,
  created_at,
  updated_at,
  workstreams(id, slug, label),
  accounts(id, name),
  pricing_tiers(id, slug, name)
`

export class CoworkApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function jsonError(error: unknown, fallbackMessage: string) {
  if (error instanceof CoworkApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: 500 }
  )
}

function firstRelation<T>(value: RelationValue<T> | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export function optionalString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

export function requiredString(value: unknown, field: string) {
  const trimmed = optionalString(value)
  if (!trimmed) {
    throw new CoworkApiError(`${field} is required`, 400)
  }
  return trimmed
}

export function optionalDate(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CoworkApiError(`${field} must be YYYY-MM-DD`, 400)
  }
  return value
}

export function parseDateParam(value: string | null, field: string) {
  if (!value) return null
  return optionalDate(value, field)
}

export function optionalIsoDatetime(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') {
    throw new CoworkApiError(`${field} must be an ISO datetime`, 400)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new CoworkApiError(`${field} must be an ISO datetime`, 400)
  }

  return parsed.toISOString()
}

export function parsePriority(value: unknown, fallback: TaskPriority = 'medium') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value !== 'string') {
    throw new CoworkApiError('priority must be low, medium, high, or urgent', 400)
  }
  const priority = value.toLowerCase() as TaskPriority
  if (!TASK_PRIORITIES.has(priority)) {
    throw new CoworkApiError('priority must be low, medium, high, or urgent', 400)
  }
  return priority
}

export function parseContactStatus(value: unknown, fallback = 'lead') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value !== 'string' || !CONTACT_STATUSES.has(value)) {
    throw new CoworkApiError('status must be lead, active, inactive, or archived', 400)
  }
  return value
}

export function parseEnquiryStatus(value: string | null, fallback = 'new') {
  if (!value) return fallback
  if (!ENQUIRY_STATUSES.has(value)) {
    throw new CoworkApiError('status must be new, reviewed, or converted', 400)
  }
  return value
}

export function parseInvoiceStatus(value: unknown, fallback: InvoiceStatus = 'draft') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value !== 'string' || !INVOICE_STATUSES.has(value as InvoiceStatus)) {
    throw new CoworkApiError('status must be draft, sent, paid, overdue, or cancelled', 400)
  }
  return value as InvoiceStatus
}

export function parseInvoiceListStatus(value: string | null) {
  if (!value) return undefined
  if (!INVOICE_STATUSES.has(value as InvoiceStatus)) {
    throw new CoworkApiError('status must be draft, sent, paid, overdue, or cancelled', 400)
  }
  return value as InvoiceStatus
}

export function parseTaskDueFilter(value: string | null) {
  const due = value ?? 'all'
  if (!['today', 'overdue', 'this_week', 'all'].includes(due)) {
    throw new CoworkApiError('due must be today, overdue, this_week, or all', 400)
  }
  return due as 'today' | 'overdue' | 'this_week' | 'all'
}

export function parseColumnKey(value: unknown) {
  if (typeof value !== 'string' || !(value in COWORK_COLUMNS)) {
    throw new CoworkApiError('column must be backlog, in-progress, review, or done', 400)
  }
  return value as CoworkColumnKey
}

export function parseProjectStatus(value: unknown, fallback = 'planning') {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value !== 'string' || !PROJECT_STATUSES.has(value)) {
    throw new CoworkApiError(
      'status must be planning, active, on_hold, completed, or cancelled',
      400
    )
  }
  return value
}

export function parseBooleanParam(value: string | null) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

export function parseLimit(
  value: string | null,
  fallback: number,
  max = 200
) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new CoworkApiError(`limit must be a positive integer up to ${max}`, 400)
  }

  return parsed
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

export function startOfDayIso(date: string) {
  return `${date}T00:00:00.000Z`
}

export function endOfDayIso(date: string) {
  return `${date}T23:59:59.999Z`
}

export async function getWorkstreamBySlug(slug: string) {
  const { data, error } = await supabaseService
    .from('workstreams')
    .select('id, slug, label')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load workstream', 500)
  }

  if (!data) {
    throw new CoworkApiError(`Unknown workstream: ${slug}`, 400)
  }

  return data as WorkstreamShape
}

export async function maybeGetWorkstreamBySlug(slug: string | null) {
  if (!slug) {
    return null
  }

  return getWorkstreamBySlug(slug)
}

export async function getColumnIdForWorkstream(workstreamId: string, column: CoworkColumnKey) {
  const { data, error } = await supabaseService
    .from('board_columns')
    .select('id')
    .eq('workstream_id', workstreamId)
    .eq('label', COWORK_COLUMNS[column])
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load board column', 500)
  }

  if (!data) {
    throw new CoworkApiError(`Column ${column} not found for workstream`, 400)
  }

  return data.id as string
}

export async function getTaskById(id: string) {
  const { data, error } = await supabaseService
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load task', 500)
  }

  if (!data) {
    throw new CoworkApiError('Task not found', 404)
  }

  return data as TaskRow
}

export async function getCalendarEventById(id: string) {
  const { data, error } = await supabaseService
    .from('calendar_events')
    .select(CALENDAR_EVENT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load calendar event', 500)
  }

  if (!data) {
    throw new CoworkApiError('Calendar event not found', 404)
  }

  return data as CalendarEventRow
}

export async function getContactById(id: string) {
  const { data, error } = await supabaseService
    .from('contacts')
    .select(CONTACT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load contact', 500)
  }

  if (!data) {
    throw new CoworkApiError('Contact not found', 404)
  }

  return data as ContactRow
}

export async function getInvoiceById(id: string) {
  const { data, error } = await supabaseService
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load invoice', 500)
  }

  if (!data) {
    throw new CoworkApiError('Invoice not found', 404)
  }

  return data as InvoiceRow
}

export async function getProjectById(id: string) {
  const { data, error } = await supabaseService
    .from('projects')
    .select(PROJECT_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load project', 500)
  }

  if (!data) {
    throw new CoworkApiError('Project not found', 404)
  }

  return data as ProjectRow
}

export async function findAccountByName(name: string) {
  const { data, error } = await supabaseService
    .from('accounts')
    .select('id, name')
    .ilike('name', name)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load account', 500)
  }

  return data as NamedRelation | null
}

export async function findContactByName(name: string) {
  const { data, error } = await supabaseService
    .from('contacts')
    .select('id, name, account_id')
    .ilike('name', name)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load contact', 500)
  }

  return data as { id: string; name: string; account_id: string | null } | null
}

export async function findPricingTierBySlug(slug: string) {
  const { data, error } = await supabaseService
    .from('pricing_tiers')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load pricing tier', 500)
  }

  if (!data) {
    throw new CoworkApiError(`Pricing tier not found: ${slug}`, 400)
  }

  return data as { id: string; slug: string; name: string }
}

export function parseLineItems(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new CoworkApiError('line_items must contain at least one item', 400)
  }

  const lineItems = value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new CoworkApiError('Each line item must be an object', 400)
    }

    const record = item as Record<string, unknown>
    const description = requiredString(record.description, 'line_items.description')
    const qty = Number(record.qty)
    const unitPrice = Number(record.unit_price)

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new CoworkApiError('line_items.qty must be a positive number', 400)
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new CoworkApiError('line_items.unit_price must be zero or greater', 400)
    }

    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id : crypto.randomUUID(),
      description,
      qty,
      unit_price: unitPrice,
    }
  })

  const totals = calculateTotals(lineItems, 0)
  if (!Number.isFinite(totals.subtotal)) {
    throw new CoworkApiError('Invalid line items', 400)
  }

  return lineItems
}

export function parseVatRate(value: unknown, fallback = 20) {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  const vatRate = Number(value)
  if (!Number.isFinite(vatRate) || vatRate < 0) {
    throw new CoworkApiError('vat_rate must be a number greater than or equal to 0', 400)
  }
  return vatRate
}

export function formatTask(row: TaskRow) {
  const workstream = firstRelation(row.workstreams)
  const project = firstRelation(row.projects)
  const column = firstRelation(row.board_columns)
  const contact = firstRelation(row.contacts)
  const account = firstRelation(row.accounts)

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    due_date: row.due_date,
    start_date: row.start_date,
    completed_at: row.completed_at,
    is_master_todo: row.is_master_todo,
    workstream: workstream ? { slug: workstream.slug, label: workstream.label } : null,
    project: project ? { id: project.id, name: project.name } : null,
    column: column?.label ?? 'Unassigned',
    contact: contact ? { id: contact.id, name: contact.name } : null,
    account: account ? { id: account.id, name: account.name } : null,
  }
}

export function formatCalendarEvent(row: CalendarEventRow) {
  const workstream = firstRelation(row.workstreams)
  const googleSync = firstRelation(row.gcal_sync)

  return {
    id: row.id,
    title: row.title,
    start_at: row.start_at,
    end_at: row.end_at,
    all_day: row.all_day,
    location: row.location,
    description: row.description,
    colour: row.colour,
    workstream: workstream ? { slug: workstream.slug, label: workstream.label } : null,
    google_synced: Boolean(googleSync?.id),
  }
}

export function formatContact(row: ContactRow) {
  const account = firstRelation(row.accounts)
  const workstream = firstRelation(row.workstreams)

  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    notes: row.notes,
    workstream: workstream ? { slug: workstream.slug, label: workstream.label } : null,
    account: account ? { id: account.id, name: account.name } : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function invoiceTitleFromLineItems(lineItems: LineItem[] | null | undefined) {
  const items = lineItems ?? []
  if (items.length === 0) {
    return 'Untitled invoice'
  }

  if (items.length === 1) {
    return items[0].description
  }

  return `${items[0].description} +${items.length - 1} more`
}

export function formatInvoice(row: InvoiceRow) {
  const account = firstRelation(row.accounts)
  const contact = firstRelation(row.contacts)
  const workstream = firstRelation(row.workstreams)
  const pricingTier = firstRelation(row.pricing_tiers)
  const vatRate = Number(row.vat_rate ?? 0)
  const lineItems = row.line_items ?? []
  const totals = calculateTotals(lineItems, vatRate)

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    title: invoiceTitleFromLineItems(lineItems),
    account: account ? { id: account.id, name: account.name } : null,
    contact: contact ? { id: contact.id, name: contact.name } : null,
    workstream: workstream ? { slug: workstream.slug, label: workstream.label } : null,
    pricing_tier: pricingTier
      ? { id: pricingTier.id, slug: pricingTier.slug, name: pricingTier.name }
      : null,
    status: row.status,
    issue_date: row.issue_date,
    due_date: row.due_date,
    paid_at: row.paid_at,
    line_items: lineItems,
    vat_rate: vatRate,
    notes: row.notes,
    subtotal: totals.subtotal,
    vat_amount: totals.vat_amount,
    total: totals.total,
    stripe_payment_link: row.stripe_payment_link,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function formatEnquiry(row: EnquiryRow) {
  return {
    id: row.id,
    biz_name: row.biz_name,
    contact_name: row.contact_name,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    biz_type: row.biz_type,
    project_type: row.project_type,
    top_features: row.top_features ?? [],
    pain_points: row.pain_points,
    timeline: row.timeline,
    budget: row.budget,
    status: row.status,
    created_at: row.created_at,
  }
}

export async function sendCoworkTaskNotification(task: { id: string; title: string }) {
  const { data: members, error } = await supabaseService
    .from('workspace_members')
    .select('workspace_id, user_id')
    .limit(20)

  if (error || !members?.length) {
    return
  }

  await supabaseService.from('notifications').insert(
    members.map((member) => ({
      workspace_id: member.workspace_id,
      user_id: member.user_id,
      type: 'system',
      title: 'Task created via Cowork',
      body: task.title,
      link: `/tasks?task=${task.id}`,
    }))
  )
}

export async function sendCoworkInvoicePaidNotification(
  invoice: Pick<InvoiceRow, 'id' | 'invoice_number'>
) {
  await sendInvoicePaidNotification(invoice.id, invoice.invoice_number)
}
