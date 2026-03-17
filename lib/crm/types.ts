// ============================================================
// CRM Types
// ============================================================

export type CrmAccountType = 'customer' | 'prospect' | 'partner' | 'vendor' | 'distributor' | 'retailer'

export type CrmAccount = {
  id: string
  workspace_id: string
  name: string
  type: CrmAccountType
  industry: string | null
  website: string | null
  phone: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  notes: string | null
  tags: string[]
  created_by: string | null
  created_at?: string
  updated_at?: string
}

export type CrmContact = {
  id: string
  workspace_id: string
  account_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  job_title: string | null
  department: string | null
  is_primary: boolean
  notes: string | null
  tags: string[]
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  account_name?: string
}

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'

export type CrmDeal = {
  id: string
  workspace_id: string
  account_id: string | null
  contact_id: string | null
  title: string
  value: number | null
  currency: string
  stage: DealStage
  probability: number
  expected_close_date: string | null
  actual_close_date: string | null
  notes: string | null
  tags: string[]
  owner_user_id: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  account_name?: string
  contact_name?: string
}

export type CrmActivityType = 'call' | 'email' | 'meeting' | 'note' | 'task'

export type CrmActivity = {
  id: string
  workspace_id: string
  account_id: string | null
  contact_id: string | null
  deal_id: string | null
  type: CrmActivityType
  subject: string
  body: string | null
  activity_date: string
  created_by: string | null
  created_at?: string
}

// ============================================================
// CRM Constants
// ============================================================

export const CRM_ACCOUNT_TYPES = ['customer', 'prospect', 'partner', 'vendor', 'distributor', 'retailer'] as const

export const CRM_ACCOUNT_TYPE_LABELS: Record<CrmAccountType, string> = {
  customer: 'Customer',
  prospect: 'Prospect',
  partner: 'Partner',
  vendor: 'Vendor',
  distributor: 'Distributor',
  retailer: 'Retailer',
}

export const DEAL_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

export const CRM_ACTIVITY_TYPES = ['call', 'email', 'meeting', 'note', 'task'] as const

export const CRM_ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  task: 'Task',
}
