export type WorkstreamColour = 'teal' | 'amber' | 'purple' | 'green' | 'coral' | string

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ContactStatus = 'lead' | 'active' | 'inactive' | 'archived'
export type EnquiryStatus = 'new' | 'reviewed' | 'converted'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Contact {
  id: string
  workstream_id: string | null
  name: string
  company: string | null
  email: string | null
  phone: string | null
  role: string | null
  status: ContactStatus
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Enquiry {
  id: string
  created_at: string
  biz_name: string
  contact_name: string
  biz_type: string | null
  team_size: string | null
  team_split: string | null
  top_features: string[]
  calendar_detail: string | null
  forms_detail: string | null
  devices: string[]
  offline_capability: string | null
  existing_tools: string | null
  pain_points: string | null
  timeline: string | null
  budget: string | null
  extra: string | null
  status: EnquiryStatus
  converted_contact_id: string | null
}

export interface EnquiryFormState {
  biz_name: string
  contact_name: string
  biz_type: string
  team_size: string
  team_split: string
  top_features: string[]
  calendar_detail: string
  forms_detail: string
  devices: string[]
  offline_capability: string
  existing_tools: string
  pain_points: string
  timeline: string
  budget: string
  extra: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  unit_price: number
}

export interface Invoice {
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
}

export interface InvoiceTotals {
  subtotal: number
  vat_amount: number
  total: number
}

export function calculateTotals(
  line_items: LineItem[],
  vat_rate: number
): InvoiceTotals {
  const subtotal = line_items.reduce((sum, item) => {
    const qty = Number.isFinite(item.qty) ? item.qty : 0
    const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0
    return sum + qty * unitPrice
  }, 0)
  const safeVatRate = Number.isFinite(vat_rate) ? vat_rate : 0
  const vat_amount = subtotal * (safeVatRate / 100)

  return {
    subtotal,
    vat_amount,
    total: subtotal + vat_amount,
  }
}

export interface Workstream {
  id: string
  slug: string
  label: string
  colour: WorkstreamColour
  sort_order: number
  created_at: string
}

export interface BoardColumn {
  id: string
  workstream_id: string
  label: string
  sort_order: number
}

export interface Task {
  id: string
  workstream_id: string | null
  column_id: string | null
  contact_id: string | null
  title: string
  description: string | null
  priority: TaskPriority
  due_date: string | null
  is_master_todo: boolean
  tags: string[]
  sort_order: number
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  workstream_id: string | null
  task_id: string | null
  title: string | null
  body: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithWorkstream extends Task {
  workstream_slug: string | null
  workstream_label: string | null
  workstream_colour: string | null
}

export interface NoteWithWorkstream extends Note {
  workstream_slug: string | null
  workstream_label: string | null
  workstream_colour: string | null
  task_title: string | null
}

export interface WorkstreamColumnCount {
  column_id: string
  label: string
  task_count: number
}

export interface WorkstreamSummary extends Workstream {
  column_counts: WorkstreamColumnCount[]
  due_this_week_count: number
  last_updated: string | null
}

export interface TaskFilters {
  workstream_id?: string | null
  workstream_ids?: string[]
  column_id?: string | null
  contact_id?: string | null
  is_master_todo?: boolean
  due_date_from?: string | null
  due_date_to?: string | null
  include_completed?: boolean
  completed?: boolean
  limit?: number
}

export interface CreateTaskInput {
  workstream_id?: string | null
  column_id?: string | null
  contact_id?: string | null
  title: string
  description?: string | null
  priority?: TaskPriority
  due_date?: string | null
  is_master_todo?: boolean
  tags?: string[]
  sort_order?: number
}

export interface UpdateTaskInput {
  workstream_id?: string | null
  column_id?: string | null
  contact_id?: string | null
  title?: string
  description?: string | null
  priority?: TaskPriority
  due_date?: string | null
  is_master_todo?: boolean
  tags?: string[]
  sort_order?: number
  completed_at?: string | null
}

export interface ReorderTaskUpdate {
  id: string
  sort_order: number
  column_id?: string | null
}
