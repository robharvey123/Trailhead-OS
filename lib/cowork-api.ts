import { NextRequest, NextResponse } from 'next/server'
import { validateCoworkToken } from '@/lib/cowork-auth'
import { supabaseService } from '@/lib/supabase/service'
import { calculateTotals, type InvoiceStatus, type LineItem, type TaskPriority } from '@/lib/types'

const TASK_PRIORITIES = new Set<TaskPriority>(['low', 'medium', 'high', 'urgent'])
const CONTACT_STATUSES = new Set(['lead', 'active', 'inactive', 'archived'])
const ENQUIRY_STATUSES = new Set(['new', 'reviewed', 'converted'])
const INVOICE_STATUSES = new Set<InvoiceStatus>(['draft', 'sent', 'paid', 'overdue', 'cancelled'])
const COWORK_COLUMNS = {
  backlog: 'Backlog',
  'in-progress': 'In progress',
  review: 'Review',
  done: 'Done',
} as const

type CoworkColumnKey = keyof typeof COWORK_COLUMNS
type RelationValue<T> = T | T[] | null

type WorkstreamRow = {
  id: string
  slug: string
  label: string
  colour: string
  sort_order: number
  created_at: string
}

type TaskRow = {
  id: string
  workstream_id: string | null
  column_id: string | null
  contact_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  is_master_todo: boolean
  tags: string[] | null
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
  workstreams?: RelationValue<Pick<WorkstreamRow, 'slug' | 'label' | 'colour'>>
}

type ContactRow = {
  id: string
  workstream_id: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  role: string | null
  status: string
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
  workstreams?: RelationValue<Pick<WorkstreamRow, 'slug' | 'label' | 'colour'>>
}

type InvoiceRow = {
  id: string
  invoice_number: string
  contact_id: string | null
  workstream_id: string | null
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  line_items: LineItem[]
  vat_rate: number
  notes: string | null
  created_at: string
  updated_at: string
  contacts?: RelationValue<{ name: string | null }>
  workstreams?: RelationValue<Pick<WorkstreamRow, 'slug' | 'label'>>
}

type CalendarEventRow = {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  workstream_id: string | null
  contact_id: string | null
  location: string | null
  colour: string | null
  created_at: string
  updated_at: string
}

type EnquiryRow = {
  id: string
  biz_name: string
  contact_name: string
  biz_type: string | null
  team_size: string | null
  top_features: string[] | null
  pain_points: string | null
  timeline: string | null
  budget: string | null
  status: string
  created_at: string
}

export class CoworkApiError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function requireCoworkAuth(request: NextRequest) {
  if (!validateCoworkToken(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  return null
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

export function parseBooleanParam(value: string | null) {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
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
  if (value === null || value === undefined) return null
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
  if (value === null || value === undefined) return null
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
    .select('id, slug, label, colour, sort_order, created_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new CoworkApiError(error.message || 'Failed to load workstream', 500)
  }

  if (!data) {
    throw new CoworkApiError(`Unknown workstream: ${slug}`, 400)
  }

  return data as WorkstreamRow
}

export async function maybeGetWorkstreamBySlug(slug: string | null) {
  if (!slug) return null
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
    .select('*, workstreams(slug, label, colour)')
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

export function mapTask(row: TaskRow) {
  const workstream = firstRelation(row.workstreams)

  return {
    id: row.id,
    title: row.title,
    workstream_id: row.workstream_id,
    priority: row.priority,
    due_date: row.due_date,
    description: row.description,
    is_master_todo: row.is_master_todo,
    completed_at: row.completed_at,
    column_id: row.column_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    workstream_slug: workstream?.slug ?? null,
    workstream_label: workstream?.label ?? null,
    workstream_colour: workstream?.colour ?? null,
  }
}

export function mapContact(row: ContactRow) {
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
    created_at: row.created_at,
    updated_at: row.updated_at,
    workstream_id: row.workstream_id,
    workstream_slug: workstream?.slug ?? null,
    workstream_label: workstream?.label ?? null,
  }
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

export function mapInvoice(row: InvoiceRow) {
  const contact = firstRelation(row.contacts)
  const workstream = firstRelation(row.workstreams)
  const totals = calculateTotals(row.line_items ?? [], Number(row.vat_rate ?? 0))

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    contact_id: row.contact_id,
    contact_name: contact?.name ?? null,
    workstream_id: row.workstream_id,
    workstream_slug: workstream?.slug ?? null,
    workstream_label: workstream?.label ?? null,
    status: row.status,
    issue_date: row.issue_date,
    due_date: row.due_date,
    line_items: row.line_items ?? [],
    vat_rate: Number(row.vat_rate ?? 0),
    notes: row.notes,
    subtotal: totals.subtotal,
    vat_amount: totals.vat_amount,
    total: totals.total,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapCalendarEvent(row: CalendarEventRow) {
  return {
    id: row.id,
    title: row.title,
    start_at: row.start_at,
    end_at: row.end_at,
    all_day: row.all_day,
    location: row.location,
    description: row.description,
    workstream_id: row.workstream_id,
    contact_id: row.contact_id,
    colour: row.colour,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function mapEnquiry(row: EnquiryRow) {
  return {
    id: row.id,
    biz_name: row.biz_name,
    contact_name: row.contact_name,
    biz_type: row.biz_type,
    team_size: row.team_size,
    top_features: row.top_features ?? [],
    pain_points: row.pain_points,
    timeline: row.timeline,
    budget: row.budget,
    status: row.status,
    created_at: row.created_at,
  }
}
