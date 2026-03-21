// ============================================================
// Finance Types
// ============================================================

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'partial' | 'overdue' | 'cancelled' | 'refunded'
export type InvoiceDirection = 'incoming' | 'outgoing'

export type InvoiceLineItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export type FinanceInvoice = {
  id: string
  workspace_id: string
  invoice_number: string
  account_id: string | null
  contact_id: string | null
  direction: InvoiceDirection
  status: InvoiceStatus
  issue_date: string
  due_date: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount_amount: number
  total: number
  amount_paid: number
  currency: string
  line_items: InvoiceLineItem[]
  notes: string | null
  payment_terms: string | null
  stream_id: string | null
  purchase_order_id: string | null
  deal_id: string | null
  recurrence_cadence: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null
  recurrence_interval: number
  next_recurrence_date: string | null
  recurrence_parent_id: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  account_name?: string
  contact_name?: string
  stream_name?: string
}

export type POStatus = 'draft' | 'submitted' | 'approved' | 'ordered' | 'partial_received' | 'received' | 'cancelled'

export type POLineItem = {
  id: string
  product_id?: string
  description: string
  sku?: string
  quantity: number
  unit_cost: number
  total: number
}

export type FinancePurchaseOrder = {
  id: string
  workspace_id: string
  po_number: string
  vendor_account_id: string | null
  status: POStatus
  order_date: string
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  subtotal: number
  tax_amount: number
  shipping_cost: number
  total: number
  currency: string
  line_items: POLineItem[]
  shipping_address: string | null
  notes: string | null
  approved_by: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  vendor_name?: string
}

export type PaymentAccountType = 'cash' | 'bank'

export type PaymentMethod = 'bank_transfer' | 'credit_card' | 'check' | 'cash' | 'paypal' | 'stripe' | 'other'

export type FinancePayment = {
  id: string
  workspace_id: string
  invoice_id: string | null
  purchase_order_id: string | null
  amount: number
  currency: string
  method: PaymentMethod | null
  reference_number: string | null
  payment_date: string
  notes: string | null
  recorded_by: string | null
  account_type: PaymentAccountType
  created_at?: string
}

export type CompanyDetails = {
  company_name: string | null
  company_address: string | null
  company_city: string | null
  company_postcode: string | null
  company_country: string | null
  company_email: string | null
  company_phone: string | null
  company_vat_number: string | null
  company_number: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_sort_code: string | null
  bank_account_number: string | null
  bank_iban: string | null
  bank_swift: string | null
}

export type BudgetCategory = 'marketing' | 'operations' | 'staffing' | 'product' | 'logistics' | 'general'

export type FinanceBudget = {
  id: string
  workspace_id: string
  name: string
  category: BudgetCategory
  period_start: string
  period_end: string
  allocated: number
  spent: number
  currency: string
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================
// Finance Constants
// ============================================================

export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled', 'refunded'] as const

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  paid: 'Paid',
  partial: 'Partially Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'text-slate-400',
  sent: 'text-blue-400',
  viewed: 'text-cyan-400',
  paid: 'text-emerald-400',
  partial: 'text-amber-400',
  overdue: 'text-rose-400',
  cancelled: 'text-slate-500',
  refunded: 'text-purple-400',
}

export const PO_STATUSES = ['draft', 'submitted', 'approved', 'ordered', 'partial_received', 'received', 'cancelled'] as const

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  ordered: 'Ordered',
  partial_received: 'Partially Received',
  received: 'Received',
  cancelled: 'Cancelled',
}

export const PAYMENT_METHODS = ['bank_transfer', 'credit_card', 'check', 'cash', 'paypal', 'stripe', 'other'] as const

export const PAYMENT_ACCOUNT_TYPES = ['cash', 'bank'] as const

export const PAYMENT_ACCOUNT_TYPE_LABELS: Record<PaymentAccountType, string> = {
  cash: 'Cash Account',
  bank: 'Bank Account',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  credit_card: 'Credit Card',
  check: 'Check',
  cash: 'Cash',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Other',
}

export const BUDGET_CATEGORIES = ['marketing', 'operations', 'staffing', 'product', 'logistics', 'general'] as const

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> = {
  marketing: 'Marketing',
  operations: 'Operations',
  staffing: 'Staffing',
  product: 'Product',
  logistics: 'Logistics',
  general: 'General',
}

// ============================================================
// Credit Notes
// ============================================================

export type CreditNoteStatus = 'draft' | 'issued' | 'applied' | 'void'

export type FinanceCreditNote = {
  id: string
  workspace_id: string
  credit_note_number: string
  invoice_id: string | null
  account_id: string | null
  direction: InvoiceDirection
  status: CreditNoteStatus
  issue_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  reason: string | null
  line_items: InvoiceLineItem[]
  notes: string | null
  created_by: string | null
  created_at?: string
  updated_at?: string
  // joined
  account_name?: string
  invoice_number?: string
}

export const CREDIT_NOTE_STATUSES = ['draft', 'issued', 'applied', 'void'] as const
export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  applied: 'Applied',
  void: 'Void',
}
export const CREDIT_NOTE_STATUS_COLORS: Record<CreditNoteStatus, string> = {
  draft: 'text-slate-400',
  issued: 'text-blue-400',
  applied: 'text-emerald-400',
  void: 'text-rose-400',
}

// ============================================================
// Expense Claims
// ============================================================

export type ExpenseCategory = 'travel' | 'meals' | 'office' | 'software' | 'marketing' | 'operations' | 'general' | 'other'
export type ExpenseClaimStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid'

export type FinanceExpenseClaim = {
  id: string
  workspace_id: string
  claimant_user_id: string
  title: string
  category: ExpenseCategory
  amount: number
  currency: string
  expense_date: string
  receipt_url: string | null
  status: ExpenseClaimStatus
  approver_user_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
  // joined
  claimant_name?: string
  approver_name?: string
}

export const EXPENSE_CATEGORIES = ['travel', 'meals', 'office', 'software', 'marketing', 'operations', 'general', 'other'] as const
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  travel: 'Travel',
  meals: 'Meals & Entertainment',
  office: 'Office Supplies',
  software: 'Software & Tools',
  marketing: 'Marketing',
  operations: 'Operations',
  general: 'General',
  other: 'Other',
}

export const EXPENSE_CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'paid'] as const
export const EXPENSE_CLAIM_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
}
export const EXPENSE_CLAIM_STATUS_COLORS: Record<ExpenseClaimStatus, string> = {
  draft: 'text-slate-400',
  submitted: 'text-blue-400',
  approved: 'text-emerald-400',
  rejected: 'text-rose-400',
  paid: 'text-cyan-400',
}
