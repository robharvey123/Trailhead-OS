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
  created_at?: string
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
