export type WorkstreamColour =
  | 'teal'
  | 'amber'
  | 'purple'
  | 'green'
  | 'coral'
  | 'blue'
  | string

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent' | 'critical'
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled'
export type ProjectMilestoneStatus = 'pending' | 'achieved' | 'missed'
export type ContactStatus = 'lead' | 'active' | 'inactive' | 'archived'
export type EnquiryStatus =
  | 'new'
  | 'reviewed'
  | 'converted'
  | 'received'
  | 'under_review'
  | 'quoted'
  | 'closed'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
export type BlogPostStatus = 'draft' | 'published'
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

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

export type TouchpointType = 'call' | 'email' | 'message' | 'meeting' | 'note'

export interface Touchpoint {
  id: string
  account_id?: string | null
  contact_id?: string | null
  engagement_id?: string | null
  /** Set when this touchpoint was logged from a calendar event (traces it back). */
  event_id?: string | null
  type: TouchpointType
  subject: string
  body?: string | null
  occurred_at: string
  created_at: string
  updated_at: string
}

export type ActivityType = 'Email' | 'Call' | 'Meeting' | 'Note' | 'Task'

export interface Activity {
  id: string
  account_id: string | null
  contact_id: string | null
  type: ActivityType
  subject: string | null
  notes: string | null
  activity_date: string
  next_action: string | null
  next_action_date: string | null
  created_at: string
}

export interface Account {
  id: string
  name: string
  website?: string
  industry?: string
  size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+'
  workstream_id?: string
  channel?: string | null
  source?: string | null
  email_contact?: string | null
  hq_address?: string | null
  status: 'prospect' | 'contacted' | 'active' | 'listed' | 'declined' | 'on_hold' | 'inactive' | 'archived'
  address_line1?: string
  address_line2?: string
  city?: string
  postcode?: string
  country?: string
  notes?: string
  default_hourly_rate?: number
  currency?: string
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
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  country: string | null
  status: ContactStatus
  channel: string | null
  website: string | null
  notes: string | null
  tags: string[]
  email_greeting?: string | null
  do_not_email?: boolean
  do_not_call?: boolean
  ctps_registered?: boolean | null
  ctps_checked_at?: string | null
  sub_trade?: string | null
  size_signal?: string | null
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
  project_id: string | null
  internal_notes: string | null
  internal_notes_updated_at: string | null
  internal_notes_author_id: string | null
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

export interface GoogleTokens {
  id: string
  access_token: string
  refresh_token: string | null
  /** base64(iv|tag|ciphertext) of the refresh token; preferred over plaintext when set. */
  refresh_token_encrypted?: string | null
  token_type: string
  expiry_date: number
  scope: string
  email: string
  label: string | null
  /** Set when Google rejects the refresh token (invalid_grant); cleared on reconnect. */
  needs_reconnect?: boolean
  auth_error?: string | null
  auth_error_at?: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// v4 — Engagements / Tier-1 milestones
// ---------------------------------------------------------------------------

export type EngagementStatus = 'Draft' | 'Active' | 'Paused' | 'Completed' | 'Terminated'

export const ENGAGEMENT_STATUSES: EngagementStatus[] = [
  'Draft', 'Active', 'Paused', 'Completed', 'Terminated',
]

export interface ApprovalThresholds {
  hours_overage_hours?: number
  travel_amount_gbp?: number
  slotting_fees_required?: boolean
  exhibition_required?: boolean
  third_party_costs_required?: boolean
}

export type EngagementType =
  | 'client_consulting'
  | 'client_app_build'
  | 'internal_app_build'
  | 'internal_ops'

export const ENGAGEMENT_TYPE_LABELS: Record<EngagementType, string> = {
  client_consulting: 'Client — consulting',
  client_app_build: 'Client — app build',
  internal_app_build: 'Internal — app build',
  internal_ops: 'Internal — ops',
}

/** Client engagements are billable; internal ones are not. Mirrors the DB generated column. */
export const isBillableType = (t: EngagementType) =>
  t === 'client_consulting' || t === 'client_app_build'

export interface Engagement {
  id: string
  end_client_account_id: string | null
  billed_via_account_id: string | null
  engagement_type: EngagementType
  is_billable: boolean
  name: string
  code: string | null
  status: EngagementStatus
  currency: string
  retainer_amount_monthly: number | null
  included_hours_monthly: number | null
  day_rate: number | null
  performance_fee_default: number | null
  start_date: string
  end_date: string | null
  notice_period_days: number | null
  auto_renews: boolean
  renewal_term_months: number | null
  notice_date?: string | null // computed in Postgres (end_date - notice_period_days), never stored
  approval_thresholds: ApprovalThresholds
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EngagementWithRelations extends Engagement {
  end_client?: { id: string; name: string } | null
  billed_via?: { id: string; name: string } | null
}

export interface EngagementInput {
  id?: string
  end_client_account_id?: string | null
  billed_via_account_id?: string | null
  engagement_type?: EngagementType
  name: string
  code?: string | null
  status?: EngagementStatus
  currency?: string
  retainer_amount_monthly?: number | null
  included_hours_monthly?: number | null
  day_rate?: number | null
  performance_fee_default?: number | null
  start_date: string
  end_date?: string | null
  notice_period_days?: number | null
  auto_renews?: boolean
  renewal_term_months?: number | null
  approval_thresholds?: ApprovalThresholds
  notes?: string | null
}

// ── Auth, roles & invites ──────────────────────────────

export type UserRole = 'owner' | 'admin' | 'employee' | 'contractor'

/** Roles an admin is allowed to assign via the invite UI (owner is DB-only). */
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'employee', 'contractor']

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  employee: 'Employee',
  contractor: 'Contractor',
}

export interface NotificationSettings {
  push_direct_message: boolean
  push_mention: boolean
  push_task_assigned: boolean
  push_new_email: boolean
}

export interface Profile {
  id: string
  person_id: string | null
  role: UserRole
  display_name: string | null
  notification_settings?: NotificationSettings | null
  created_at: string
  updated_at: string
}

export interface Invite {
  id: string
  email: string
  role: UserRole
  person_id: string | null
  token: string
  invited_by: string | null
  expires_at: string
  claimed_at: string | null
  claimed_by: string | null
  created_at: string
}

// ── Engagement tasks (ticket board) ────────────────────

export type EngagementTaskStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'cancelled'
export type EngagementTaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export const ENGAGEMENT_TASK_STATUSES: EngagementTaskStatus[] = ['backlog', 'in_progress', 'review', 'done', 'cancelled']
export const ENGAGEMENT_TASK_STATUS_LABELS: Record<EngagementTaskStatus, string> = {
  backlog: 'Backlog', in_progress: 'In progress', review: 'Review', done: 'Done', cancelled: 'Cancelled',
}
// Colour is part of the status definition — rendered as status chips everywhere
// via <TaskStatusBadge>. Hex (not Tailwind classes) so it can be applied inline.
export const ENGAGEMENT_TASK_STATUS_COLOURS: Record<EngagementTaskStatus, string> = {
  backlog: '#6B7280', in_progress: '#3B82F6', review: '#F59E0B', done: '#10B981', cancelled: '#EF4444',
}
// Columns shown on the kanban board (cancelled is reachable but not a board column).
export const ENGAGEMENT_TASK_BOARD_COLUMNS: EngagementTaskStatus[] = ['backlog', 'in_progress', 'review', 'done']
export const ENGAGEMENT_TASK_PRIORITIES: EngagementTaskPriority[] = ['urgent', 'high', 'normal', 'low']
export const ENGAGEMENT_TASK_PRIORITY_LABELS: Record<EngagementTaskPriority, string> = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
}
/** For "priority desc" sorts. */
export const ENGAGEMENT_TASK_PRIORITY_RANK: Record<EngagementTaskPriority, number> = {
  urgent: 3, high: 2, normal: 1, low: 0,
}

export interface EngagementTask {
  id: string
  engagement_id: string | null
  project_id?: string | null
  title: string
  description: string | null
  status: EngagementTaskStatus
  priority: EngagementTaskPriority
  assignee_person_id: string | null
  reporter_person_id: string | null
  due_date: string | null
  labels: string[]
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

type TaskPersonRef = { id: string; full_name: string } | null

export interface EngagementTaskWithRelations extends EngagementTask {
  assignee?: TaskPersonRef
  reporter?: TaskPersonRef
  engagement?: { id: string; name: string } | null
  project?: { id: string; name: string } | null
}

export interface EngagementTaskComment {
  id: string
  task_id: string
  author_person_id: string | null
  body: string
  created_at: string
  updated_at: string
}

export interface EngagementTaskCommentWithAuthor extends EngagementTaskComment {
  author?: TaskPersonRef
}

export interface EngagementTaskActivity {
  id: string
  task_id: string
  actor_user_id: string | null
  kind: string
  payload: Record<string, unknown>
  created_at: string
}

// ── People & contributors ──────────────────────────────

export interface Person {
  id: string
  full_name: string
  email: string | null
  auth_user_id: string | null
  default_hourly_rate_gbp: number | null
  is_active: boolean
  created_at: string
}

export interface EngagementContributor {
  id: string
  engagement_id: string
  person_id: string
  role: string | null
  hourly_rate_gbp: number
  is_active: boolean
  created_at: string
}

export interface EngagementContributorWithPerson extends EngagementContributor {
  person?: Pick<Person, 'id' | 'full_name' | 'email'> | null
}

export interface Tier1Milestone {
  id: string
  engagement_id: string
  account_id: string
  range_review_decided_at: string | null
  go_live_confirmed_at: string | null
  first_po_received_at: string | null
  is_complete: boolean
  completed_at: string | null
  performance_fee: number | null
  fee_invoice_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Tier1MilestoneWithAccount extends Tier1Milestone {
  account?: { id: string; name: string; channel: string | null } | null
}

export interface EngagementHoursByMonth {
  engagement_id: string
  period_month: string | null
  hours_used: number
  hours_included: number | null
  hours_over: number
  billable_hours: number
}

export interface Tier1MilestoneSummary {
  engagement_id: string
  total_tracked: number
  completed: number
  in_progress: number
  billable_not_invoiced: number
  invoiced: number
}

export type ApprovalType = 'hours_overage' | 'slotting_fee' | 'exhibition' | 'travel' | 'third_party'
export type ApprovalStatus = 'Open' | 'Approved' | 'Declined' | 'Withdrawn'

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  hours_overage: 'Hours overage',
  slotting_fee: 'Slotting fee',
  exhibition: 'Exhibition spend',
  travel: 'Travel',
  third_party: 'Third-party cost',
}

export interface ApprovalRequest {
  id: string
  engagement_id: string
  requester_id: string | null
  approver_id: string | null
  type: ApprovalType
  amount: number | null
  currency: string
  description: string | null
  status: ApprovalStatus
  requested_at: string
  decided_at: string | null
  decision_notes: string | null
  related_entity_type: 'time_entry' | 'invoice_line' | 'expense' | 'milestone' | null
  related_entity_id: string | null
  gmail_thread_id: string | null
  created_at: string
}

export interface ApprovalRequestWithRelations extends ApprovalRequest {
  approver?: { id: string; name: string; email: string | null } | null
}

export type EmailMatchMethod = 'contact_email' | 'domain' | 'unmatched' | 'manual'

/** One captured Gmail attachment part (metadata only; bytes fetched on demand). */
export interface EmailAttachmentMeta {
  filename: string
  mime_type: string
  attachment_id: string
  size_bytes: number
}

export interface EmailLog {
  id: string
  gmail_message_id?: string
  gmail_thread_id?: string
  account_id?: string | null
  contact_id?: string | null
  enquiry_id?: string | null
  quote_id?: string | null
  direction: 'inbound' | 'outbound'
  from_address: string
  from_name?: string | null
  to_addresses: string[]
  cc_addresses?: string[]
  bcc_addresses?: string[]
  subject: string
  snippet?: string
  body_html?: string | null
  body_text?: string | null
  is_unread?: boolean
  is_starred?: boolean
  labels?: string[]
  attachments?: EmailAttachmentMeta[]
  match_method?: EmailMatchMethod | null
  received_at?: string
  sent_at?: string
  created_at: string
}

/** A grouped email thread for the inbox (derived from email_logs by gmail_thread_id). */
export interface EmailThread {
  gmail_thread_id: string
  account_id: string | null
  account_name?: string | null
  contact_id?: string | null
  contact_name?: string | null
  subject: string
  snippet: string
  from_name: string
  from_address: string
  last_at: string
  message_count: number
  is_unread: boolean
  is_starred: boolean
  in_inbox: boolean
  match_method: EmailMatchMethod | null
  has_attachments: boolean
  has_outbound: boolean
  in_trash: boolean
}

export interface GcalSync {
  id: string
  calendar_event_id: string
  gcal_event_id: string
  gcal_calendar_id: string
  last_synced_at: string
  sync_direction: 'push' | 'pull' | 'both'
}

export interface MicrosoftTokens {
  id: string
  access_token: string
  refresh_token: string
  token_type: string
  expiry_date: number
  scope: string
  email: string
  label: string | null
  created_at: string
  updated_at: string
}

export interface MsCalSync {
  id: string
  calendar_event_id: string
  ms_event_id: string
  ms_calendar_id: string
  microsoft_token_id: string
  last_synced_at: string
  sync_direction: 'push' | 'pull' | 'both'
}

export interface StripeCustomer {
  id: string
  account_id: string
  contact_id?: string
  stripe_customer_id: string
  stripe_subscription_id?: string
  subscription_status?: string
  created_at: string
  updated_at: string
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

export interface QuoteDraftPricingItem {
  item: string
  description: string
  amount: string
}

export interface QuoteDraftContent {
  overview: string
  approach: string
  scope: string[]
  assumptions: string[]
  pricing: QuoteDraftPricingItem[]
  next_steps: string
}

export type PricingType = 'fixed' | 'time_and_materials' | 'milestone'
export type QuoteStatus =
  | 'draft'
  | 'review'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'declined'
  | 'expired'
  | 'converted'

export interface Invoice {
  id: string
  invoice_number: string
  account_id: string | null
  contact_id: string | null
  workstream_id: string | null
  engagement_id?: string | null
  pricing_tier_id?: string
  pricing_tier?: PricingTier
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  line_items: LineItem[]
  vat_rate: number
  // Optional on write (DB defaults to GBP @ 1.0); always present on read.
  currency?: string
  fx_rate_to_gbp?: number
  fx_rate_quote?: number | null
  fx_rate_date?: string | null
  fx_rate_source?: string | null
  stripe_payment_link?: string
  stripe_payment_intent_id?: string
  stripe_session_id?: string
  stripe_subscription_id?: string
  paid_at?: string
  is_recurring?: boolean
  recurring_interval?: 'month' | 'year' | null
  next_invoice_date?: string | null
  bill_to_name: string | null
  bill_to_address: string | null
  bill_to_city: string | null
  bill_to_postcode: string | null
  bill_to_country: string | null
  bill_to_email: string | null
  bill_to_phone: string | null
  notes: string | null
  freeagent_invoice_url?: string | null
  freeagent_synced_at?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
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
  project_id?: string
  pricing_tier_id?: string
  pricing_tier?: PricingTier
  status: QuoteStatus
  pricing_type: PricingType
  title: string
  summary?: string
  estimated_hours?: number
  estimated_timeline?: string
  draft_content?: QuoteDraftContent | null
  final_content?: QuoteDraftContent | null
  version: number
  generated_at?: string | null
  sent_at?: string | null
  created_by_id?: string | null
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
  project?: { id: string; name: string; status: ProjectStatus }
  totals: InvoiceTotals
}

export interface QuoteListItem extends QuoteWithRelations {
  account_name: string | null
  contact_name: string | null
  contact_company: string | null
  enquiry?: Enquiry
  invoice?: Invoice | null
}

export interface QuoteVersion {
  id: string
  quote_id: string
  version: number
  content: QuoteDraftContent
  generated_at: string
  created_at: string
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

export interface ProjectContact {
  project_id: string
  contact_id: string
  relationship_role: string | null
  created_at: string
  contact?: Contact | null
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description: string | null
  sort_order: number
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  task_count?: number
}

export interface ProjectMilestone {
  id: string
  project_id: string
  name: string
  title: string
  description: string | null
  date: string
  due_date: string
  status: ProjectMilestoneStatus
  colour: string
  order_index: number
  completed: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  workstream_id: string
  account_id: string | null
  owner_id: string | null
  pricing_tier_id: string | null
  name: string
  title: string
  description: string | null
  brief: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  estimated_end_date: string | null
  colour: string | null
  owner: string | null
  ai_planned: boolean
  hourly_rate?: number
  currency?: string
  engagement_id?: string | null
  ended_at?: string | null
  ended_reason?: string | null
  created_at: string
  updated_at: string
}

export interface ProjectListItem extends Project {
  workstream?: Workstream | null
  account?: Account | null
  task_count: number
  completed_task_count: number
  contact_count: number
  next_milestone: ProjectMilestone | null
}

export interface ProjectDetail extends Project {
  workstream?: Workstream | null
  account?: Account | null
  phases: ProjectPhase[]
  milestones: ProjectMilestone[]
  tasks: TaskWithWorkstream[]
  task_checklists: TaskChecklistItem[]
  task_attachments: TaskAttachment[]
  task_time_logs: TaskTimeLog[]
  task_activity: TaskActivityEntry[]
  task_dependencies: TaskDependency[]
  contacts: Contact[]
  enquiries: Enquiry[]
}

export interface Task {
  id: string
  workstream_id: string | null
  column_id: string | null
  account_id: string | null
  contact_id: string | null
  project_id: string | null
  phase_id: string | null
  parent_task_id: string | null
  owner_user_id: string | null
  title: string
  description: string | null
  status: ProjectTaskStatus
  priority: TaskPriority
  owner: string | null
  start_date: string | null
  due_date: string | null
  due_time: string | null
  estimated_hours: number | null
  actual_hours: number | null
  is_master_todo: boolean
  tags: string[]
  sort_order: number
  order_index: number
  custom_fields: Record<string, string | number | boolean | null>
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskChecklistItem {
  id: string
  task_id: string
  title: string
  is_complete: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  filename: string
  storage_path: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskTimeLog {
  id: string
  task_id: string
  description: string | null
  hours: number
  logged_date: string
  logged_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskActivityEntry {
  id: string
  task_id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'field_update'
  content: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TaskDependency {
  id: string
  task_id: string
  depends_on_task_id: string
  type: 'blocks' | 'blocked_by'
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
  user_id: string | null
  workstream_id: string | null
  contact_id: string | null
  project_id: string | null
  location: string | null
  colour: string | null
  source: 'manual' | 'google' | 'feed' | 'microsoft'
  feed_id: string | null
  external_uid: string | null
  read_only: boolean
  meet_link: string | null
  html_link: string | null
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
  project_name: string | null
  project_title: string | null
  phase_name: string | null
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
  project_id?: string | null
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
  project_id?: string | null
  parent_task_id?: string | null
  owner_user_id?: string | null
  title: string
  description?: string | null
  status?: ProjectTaskStatus
  priority?: TaskPriority
  owner?: string | null
  start_date?: string | null
  due_date?: string | null
  due_time?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  is_master_todo?: boolean
  tags?: string[]
  sort_order?: number
  order_index?: number
  custom_fields?: Record<string, string | number | boolean | null>
}

export interface UpdateTaskInput {
  workstream_id?: string | null
  column_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  project_id?: string | null
  parent_task_id?: string | null
  owner_user_id?: string | null
  title?: string
  description?: string | null
  status?: ProjectTaskStatus
  priority?: TaskPriority
  owner?: string | null
  start_date?: string | null
  due_date?: string | null
  due_time?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  is_master_todo?: boolean
  tags?: string[]
  sort_order?: number
  order_index?: number
  custom_fields?: Record<string, string | number | boolean | null>
  completed_at?: string | null
}

export interface ReorderTaskUpdate {
  id: string
  sort_order: number
  order_index?: number
  column_id?: string | null
  status?: ProjectTaskStatus
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

// ── Expenses ──────────────────────────────────────────────

export type ExpenseCategory =
  | 'travel'
  | 'software'
  | 'equipment'
  | 'meals'
  | 'subscriptions'
  | 'other'

export interface Expense {
  id: string
  created_at: string
  updated_at: string
  date: string
  description: string
  amount: number
  currency: string
  category: ExpenseCategory
  receipt_url: string | null
  workstream_id: string | null
  account_id: string | null
  project_id: string | null
  billable: boolean
  billed: boolean
  invoice_id: string | null
  tax_deductible: boolean
  notes: string | null
  user_id: string
}

export interface ExpenseWithRelations extends Expense {
  workstream?: { label: string; colour: string }
  account?: Account
  project?: { id: string; name: string }
  invoice?: { id: string; invoice_number: string }
}

// ── Timesheet & Time Tracking ──────────────────────────

export type TimeEntrySource = 'manual' | 'timer' | 'cowork'

export interface TimeEntry {
  id: string
  user_id: string
  person_id?: string | null
  account_id: string | null
  project_id: string | null
  engagement_id?: string | null
  task_id?: string | null
  entry_date: string
  start_at: string | null
  end_at: string | null
  duration_minutes: number
  description: string | null
  billable: boolean
  rate_snapshot: number
  currency_snapshot: string
  source: TimeEntrySource
  is_running: boolean
  invoice_id?: string | null
  billed?: boolean
  created_at: string
  updated_at: string
}

export interface TimeEntryWithRelations extends TimeEntry {
  account?: Account | null
  project?: { id: string; name: string } | null
}

/** A group of unbilled billable time for one project (or general time),
 *  surfaced on the invoice form so hours can be pulled onto an invoice. */
export interface UnbilledTimeGroup {
  project_id: string | null
  project_name: string
  engagement_id: string | null
  minutes: number
  amount: number
  rate: number
  entry_ids: string[]
}

export interface RunningTimer extends TimeEntry {
  elapsed_seconds: number
}

export interface AccountTimeTotals {
  account_id: string
  business_name: string
  total_minutes: number
  billable_minutes: number
  billable_amount: number
}

export interface ProjectTimeTotals {
  project_id: string
  account_id: string | null
  project_name: string
  project_status: ProjectStatus
  total_minutes: number
  billable_minutes: number
  billable_amount: number
  last_entry_date: string | null
}

// ---------------------------------------------------------------------------
// CRM v3 — Deals / Tags / Saved Views
// ---------------------------------------------------------------------------

export type DealStage =
  | 'New'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'On Hold'

export const DEAL_STAGES: DealStage[] = [
  'New',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'On Hold',
]

// Stages shown as kanban columns (Won/Lost are terminal — set via card actions).
export const DEAL_PIPELINE_STAGES: DealStage[] = [
  'New',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'On Hold',
]

export const DEAL_SOURCES = [
  'Referral',
  'Inbound',
  'Outbound',
  'Existing Client',
  'Event',
  'Other',
] as const

export type DealSource = (typeof DEAL_SOURCES)[number]

export interface Deal {
  id: string
  account_id: string
  primary_contact_id: string | null
  owner_id: string | null
  name: string
  stage: DealStage
  value_amount: number | null
  value_currency: string
  probability: number
  expected_close_date: string | null
  closed_at: string | null
  source: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DealWithRelations extends Deal {
  account?: { id: string; name: string } | null
  primary_contact?: { id: string; name: string } | null
  projects?: Array<{ id: string; name: string }>
}

export interface DealInput {
  id?: string
  account_id: string
  primary_contact_id?: string | null
  name: string
  stage?: DealStage
  value_amount?: number | null
  value_currency?: string
  probability?: number
  expected_close_date?: string | null
  source?: string | null
  notes?: string | null
  /** When provided, the deal's linked projects are reconciled to exactly this set. */
  project_ids?: string[]
}

export interface PipelineStageSummary {
  stage: DealStage
  deal_count: number
  total_value: number
  weighted_value: number
}

export interface DealForecastBucket {
  month: string // YYYY-MM
  deal_count: number
  total_value: number
  weighted_value: number
}

export type TagColor = 'accent' | 'green' | 'amber' | 'red' | 'emerald' | 'grey'

export interface Tag {
  id: string
  name: string
  color: TagColor
}

export type SavedViewEntity = 'accounts' | 'deals' | 'tasks' | 'timesheet' | 'inbox'

export interface SavedView {
  id: string
  owner_id: string | null
  entity: SavedViewEntity
  name: string
  filters: Record<string, unknown>
  sort: Record<string, unknown> | null
  is_pinned: boolean
  created_at: string
}

export interface SavedViewInput {
  id?: string
  entity: SavedViewEntity
  name: string
  filters?: Record<string, unknown>
  sort?: Record<string, unknown> | null
  is_pinned?: boolean
}

// ============================================================================
// Outreach engine (campaigns, recipients, sends, suppressions)
// ============================================================================

export type OutreachCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
export const OUTREACH_CAMPAIGN_STATUSES: OutreachCampaignStatus[] = ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']
export const OUTREACH_CAMPAIGN_STATUS_LABELS: Record<OutreachCampaignStatus, string> = {
  draft: 'Draft', scheduled: 'Scheduled', running: 'Running', paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled',
}

export type OutreachRecipientStatus = 'pending' | 'active' | 'completed' | 'stopped'
export const OUTREACH_RECIPIENT_STATUSES: OutreachRecipientStatus[] = ['pending', 'active', 'completed', 'stopped']
export const OUTREACH_RECIPIENT_STATUS_LABELS: Record<OutreachRecipientStatus, string> = {
  pending: 'Pending', active: 'Active', completed: 'Completed', stopped: 'Stopped',
}

export type OutreachStoppedReason = 'replied' | 'unsubscribed' | 'bounced' | 'complained' | 'manual' | 'converted' | 'error'
export const OUTREACH_STOPPED_REASONS: OutreachStoppedReason[] = ['replied', 'unsubscribed', 'bounced', 'complained', 'manual', 'converted', 'error']
export const OUTREACH_STOPPED_REASON_LABELS: Record<OutreachStoppedReason, string> = {
  replied: 'Replied', unsubscribed: 'Unsubscribed', bounced: 'Bounced', complained: 'Complained', manual: 'Manual', converted: 'Converted', error: 'Error',
}

export type OutreachSendStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed'
export const OUTREACH_SEND_STATUSES: OutreachSendStatus[] = ['queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed']
export const OUTREACH_SEND_STATUS_LABELS: Record<OutreachSendStatus, string> = {
  queued: 'Queued', sent: 'Sent', delivered: 'Delivered', opened: 'Opened', clicked: 'Clicked', bounced: 'Bounced', complained: 'Complained', failed: 'Failed',
}

export type EmailSuppressionReason = 'unsubscribed' | 'bounced' | 'complained' | 'manual'
export const EMAIL_SUPPRESSION_REASONS: EmailSuppressionReason[] = ['unsubscribed', 'bounced', 'complained', 'manual']

export interface OutreachAudience {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface OutreachTemplate {
  id: string
  name: string
  subject: string
  body_html: string
  body_text: string | null
  created_at: string
  updated_at: string
}

export interface OutreachCampaign {
  id: string
  name: string
  project_id: string | null
  audience_id: string | null
  status: OutreachCampaignStatus
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  daily_send_cap: number
  send_window_start: string
  send_window_end: string
  send_days: number[]
  timezone: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface OutreachCampaignStep {
  id: string
  campaign_id: string
  step_number: number
  template_id: string | null
  delay_days: number
}

export interface OutreachRecipient {
  id: string
  campaign_id: string
  contact_id: string
  status: OutreachRecipientStatus
  current_step: number
  next_send_at: string | null
  stopped_reason: OutreachStoppedReason | null
  stopped_at: string | null
  call_status: string | null
  call_last_at: string | null
  unsubscribe_token: string
  created_at: string
}

export interface OutreachSend {
  id: string
  campaign_id: string
  recipient_id: string
  step_id: string | null
  resend_email_id: string | null
  subject: string | null
  status: OutreachSendStatus
  sent_at: string | null
  delivered_at: string | null
  first_opened_at: string | null
  first_clicked_at: string | null
  error: string | null
  created_at: string
}

export interface OutreachEvent {
  id: string
  send_id: string | null
  resend_email_id: string | null
  type: string | null
  payload: Record<string, unknown> | null
  occurred_at: string | null
  created_at: string
}

export interface EmailSuppression {
  id: string
  email: string
  reason: EmailSuppressionReason | null
  source: string | null
  notes: string | null
  created_at: string
}

export interface OutreachCampaignStats {
  campaign_id: string
  audience_size: number
  recipients: number
  stopped: number
  replied: number
  sent: number
  delivered: number
  opened: number
}
