// ============================================================
// Trailhead Holdings Types
// ============================================================

// --- Income Streams ---

export type IncomeStreamType = 'saas' | 'commission' | 'consulting' | 'product' | 'other'

export type IncomeStream = {
  id: string
  workspace_id: string
  name: string
  type: IncomeStreamType
  description: string | null
  account_id: string | null
  is_active: boolean
  config: Record<string, unknown>
  currency: string
  created_at?: string
  updated_at?: string
  // joined
  account_name?: string
}

export const STREAM_TYPES = ['saas', 'commission', 'consulting', 'product', 'other'] as const

export const STREAM_TYPE_LABELS: Record<IncomeStreamType, string> = {
  saas: 'SaaS',
  commission: 'Commission',
  consulting: 'Consulting',
  product: 'Product',
  other: 'Other',
}

export const STREAM_TYPE_COLORS: Record<IncomeStreamType, string> = {
  saas: 'text-violet-400',
  commission: 'text-emerald-400',
  consulting: 'text-blue-400',
  product: 'text-amber-400',
  other: 'text-slate-400',
}

export const STREAM_TYPE_BG_COLORS: Record<IncomeStreamType, string> = {
  saas: 'bg-violet-400/10 text-violet-400',
  commission: 'bg-emerald-400/10 text-emerald-400',
  consulting: 'bg-blue-400/10 text-blue-400',
  product: 'bg-amber-400/10 text-amber-400',
  other: 'bg-slate-400/10 text-slate-400',
}

// --- Commission ---

export type CommissionType = 'percentage' | 'fixed_per_unit'

export type CommissionRate = {
  id: string
  workspace_id: string
  stream_id: string
  source_workspace_id: string
  brand: string
  commission_type: CommissionType
  rate: number
  effective_from: string
  effective_to: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
  // joined
  stream_name?: string
  source_workspace_name?: string
}

export type CommissionEarning = {
  brand: string
  customer: string
  date: string
  qty_cans: number
  revenue: number
  commission_type: CommissionType
  rate: number
  earned: number
  source_workspace_id: string
}

// --- Workspace Links ---

export type WorkspaceLink = {
  id: string
  workspace_id: string
  linked_workspace_id: string
  label: string | null
  created_at?: string
  // joined
  linked_workspace_name?: string
}

// --- Expenses ---

export type ExpenseCategory =
  | 'operations'
  | 'marketing'
  | 'staffing'
  | 'travel'
  | 'office'
  | 'software'
  | 'legal'
  | 'other'

export type HoldingExpense = {
  id: string
  workspace_id: string
  stream_id: string | null
  category: ExpenseCategory
  description: string
  amount: number
  currency: string
  expense_date: string
  vendor: string | null
  is_recurring: boolean
  recurrence_period: string | null
  receipt_url: string | null
  notes: string | null
  created_by: string | null
  created_at?: string
  // joined
  stream_name?: string
}

export const EXPENSE_CATEGORIES = [
  'operations', 'marketing', 'staffing', 'travel', 'office', 'software', 'legal', 'other',
] as const

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  operations: 'Operations',
  marketing: 'Marketing',
  staffing: 'Staffing',
  travel: 'Travel',
  office: 'Office',
  software: 'Software',
  legal: 'Legal',
  other: 'Other',
}

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  operations: 'bg-blue-500',
  marketing: 'bg-pink-500',
  staffing: 'bg-emerald-500',
  travel: 'bg-amber-500',
  office: 'bg-slate-500',
  software: 'bg-violet-500',
  legal: 'bg-red-500',
  other: 'bg-cyan-500',
}

// --- Stripe Payments ---

export type StripePaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded'

export type StripePayment = {
  id: string
  workspace_id: string
  stream_id: string | null
  stripe_payment_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  customer_email: string | null
  customer_name: string | null
  amount: number
  currency: string
  status: StripePaymentStatus
  payment_date: string
  description: string | null
  metadata: Record<string, unknown>
  created_at?: string
}

// --- Bank Transactions ---

export type BankTransactionSource = 'csv_import' | 'open_banking'

export type BankTransaction = {
  id: string
  workspace_id: string
  external_id: string
  source: BankTransactionSource
  date: string
  amount: number
  currency: string
  counterparty: string | null
  reference: string | null
  description: string | null
  category: string | null
  balance_after: number | null
  matched_invoice_id: string | null
  matched_expense_id: string | null
  matched_stripe_id: string | null
  reconciled: boolean
  notes: string | null
  imported_at?: string
  created_at?: string
}

// --- Dashboard ---

export type StreamRevenue = {
  stream_id: string
  stream_name: string
  stream_type: IncomeStreamType
  revenue: number
}

export type MonthlyFlow = {
  month: string
  money_in: number
  money_out: number
  net: number
}

export type DashboardSummary = {
  total_revenue: number
  total_expenses: number
  net_profit: number
  bank_balance: number | null
  outstanding_invoices: number
  unreconciled_count: number
  by_stream: StreamRevenue[]
  monthly: MonthlyFlow[]
}
