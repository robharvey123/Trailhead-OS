export type WorkstreamColour =
  | 'teal'
  | 'amber'
  | 'purple'
  | 'green'
  | 'coral'
  | string

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ContactStatus = 'lead' | 'active' | 'inactive' | 'archived'
export type EnquiryStatus = 'new' | 'reviewed' | 'converted'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type BlogPostStatus = 'draft' | 'published'

export interface PricingTier {
  id: string
  name: string
  slug: 'mates' | 'budget' | 'standard'
  description?: string
  hourly_rate: number
  day_rate: number
  monthly_retainer: number
  hosting_maintenance: number
  fixed_fee_margin: number
  sort_order: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  name: string
  website?: string
  industry?: string
  size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+'
  workstream_id?: string
  status: 'prospect' | 'active' | 'inactive' | 'archived'
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  notes?: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface AccountWithRelations extends Account {
  workstream?: { label: string; colour: string }
  contacts?: Contact[]
  quotes?: Quote[]
}

export type AccountStatus = Account['status']

export interface Contact {
  id: string
  workstream_id: string | null
  account_id: string | null
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
  contact_email: string | null
  contact_phone: string | null
  biz_type: string | null
  project_type: string | null
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
  referral_source: string | null
  budget: string | null
  extra: string | null
  status: EnquiryStatus
  account_id: string | null
  converted_contact_id: string | null
}

export interface EnquiryFormState {
  biz_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  biz_type: string
  project_type: string
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
  referral_source: string
  budget: string
  extra: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  unit_price: number
}

export interface QuoteScope {
  phase: string
  description: string
  deliverables: string[]
  duration: string
  estimated_hours?: number
}

export interface QuoteComplexityBreakdown {
  features_scored: string[]
  overhead_hours: number
  total_hours_before_buffer: number
  buffer_applied: string
  total_hours_final: number
}

export interface QuoteLineItem {
  id: string
  description: string
  qty: number
  unit_price: number
  type: 'fixed' | 'hourly' | 'milestone'
}

export type PricingType = 'fixed' | 'time_and_materials' | 'milestone'
export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'converted'

export interface Invoice {
  id: string
  invoice_number: string
  account_id: string | null
  contact_id: string | null
  workstream_id: string | null
  pricing_tier_id?: string
  pricing_tier?: PricingTier
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

export interface Quote {
  id: string
  quote_number: string
  account_id?: string
  contact_id?: string
  workstream_id?: string
  enquiry_id?: string
  pricing_tier_id?: string
  pricing_tier?: PricingTier
  status: QuoteStatus
  pricing_type: PricingType
  title: string
  summary?: string
  estimated_hours?: number
  estimated_timeline?: string
  scope: QuoteScope[]
  line_items: QuoteLineItem[]
  vat_rate: number
  valid_until?: string
  payment_terms?: string
  notes?: string
  complexity_breakdown?: QuoteComplexityBreakdown
  converted_invoice_id?: string
  ai_generated: boolean
  ai_generated_at?: string
  issue_date: string
  created_at: string
  updated_at: string
}

export interface QuoteWithRelations extends Quote {
  account?: Account
  contact?: Contact
  workstream?: { label: string; colour: string }
  totals: InvoiceTotals
}

export interface QuoteListItem extends QuoteWithRelations {
  account_name: string | null
  contact_name: string | null
  contact_company: string | null
  enquiry?: Enquiry
  invoice?: Invoice | null
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
  account_id: string | null
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

export interface CalendarEvent {
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

export type CalendarItem =
  | { type: 'task'; data: Task }
  | { type: 'event'; data: CalendarEvent }

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

export type DashboardUpcomingItem =
  | {
      type: 'task'
      date: string
      sort_at: string
      data: TaskWithWorkstream
    }
  | {
      type: 'event'
      date: string
      sort_at: string
      data: CalendarEvent
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
  account_id?: string | null
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
  account_id?: string | null
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
  account_id?: string | null
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

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  published: boolean
  published_at: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface BlogPostInput {
  title: string
  slug: string
  excerpt?: string | null
  body: string
  published?: boolean
  published_at?: string | null
  tags?: string[]
}
