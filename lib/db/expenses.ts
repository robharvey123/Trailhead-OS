import { createClient } from '@/lib/supabase/server'
import type {
  Account,
  Expense,
  ExpenseCategory,
  ExpenseWithRelations,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type ExpenseRow = Expense & {
  workstreams: { label: string; colour: string } | null
  accounts: Account | null
  projects: { id: string; name: string } | null
  invoices: { id: string; invoice_number: string } | null
}

const EXPENSE_SELECT =
  '*, workstreams(label, colour), accounts(*), projects(id, name), invoices(id, invoice_number)'

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapExpense(row: ExpenseRow): ExpenseWithRelations {
  return {
    ...row,
    workstream: row.workstreams ?? undefined,
    account: row.accounts ?? undefined,
    project: row.projects ?? undefined,
    invoice: row.invoices ?? undefined,
  }
}

export interface ExpenseFilters {
  workstream_id?: string
  account_id?: string
  project_id?: string
  category?: ExpenseCategory
  billable?: boolean
  billed?: boolean
  date_from?: string
  date_to?: string
}

export async function getExpenses(
  filters: ExpenseFilters = {},
  client?: SupabaseClient
): Promise<ExpenseWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }
  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }
  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (typeof filters.billable === 'boolean') {
    query = query.eq('billable', filters.billable)
  }
  if (typeof filters.billed === 'boolean') {
    query = query.eq('billed', filters.billed)
  }
  if (filters.date_from) {
    query = query.gte('date', filters.date_from)
  }
  if (filters.date_to) {
    query = query.lte('date', filters.date_to)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load expenses')
  }

  return ((data ?? []) as ExpenseRow[]).map(mapExpense)
}

export async function getExpenseById(
  id: string,
  client?: SupabaseClient
): Promise<ExpenseWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load expense')
  }

  return data ? mapExpense(data as ExpenseRow) : null
}

export async function createExpense(
  data: Omit<Expense, 'id' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<ExpenseWithRelations> {
  const supabase = await getSupabase(client)
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert(data)
    .select(EXPENSE_SELECT)
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create expense')
  }

  return mapExpense(expense as ExpenseRow)
}

export async function updateExpense(
  id: string,
  data: Partial<Expense>,
  client?: SupabaseClient
): Promise<ExpenseWithRelations> {
  const supabase = await getSupabase(client)
  const { data: expense, error } = await supabase
    .from('expenses')
    .update(data)
    .eq('id', id)
    .select(EXPENSE_SELECT)
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update expense')
  }

  return mapExpense(expense as ExpenseRow)
}

export async function deleteExpense(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete expense')
  }
}

export async function getUnbilledExpensesForAccount(
  accountId: string,
  client?: SupabaseClient
): Promise<ExpenseWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('account_id', accountId)
    .eq('billable', true)
    .eq('billed', false)
    .order('date', { ascending: false })

  if (error) {
    throw new Error(error.message || 'Failed to load unbilled expenses')
  }

  return ((data ?? []) as ExpenseRow[]).map(mapExpense)
}

export async function uploadReceipt(
  expenseId: string,
  file: File,
  client?: SupabaseClient
): Promise<string> {
  const supabase = await getSupabase(client)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${expenseId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, file, { upsert: true })

  if (uploadError) {
    throw new Error(uploadError.message || 'Failed to upload receipt')
  }

  const { data: urlData } = supabase.storage
    .from('receipts')
    .getPublicUrl(path)

  const receiptUrl = urlData.publicUrl

  const { error: updateError } = await supabase
    .from('expenses')
    .update({ receipt_url: receiptUrl })
    .eq('id', expenseId)

  if (updateError) {
    throw new Error(updateError.message || 'Failed to save receipt URL')
  }

  return receiptUrl
}

export async function markExpensesAsBilled(
  expenseIds: string[],
  invoiceId: string,
  client?: SupabaseClient
): Promise<void> {
  if (expenseIds.length === 0) return

  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('expenses')
    .update({ billed: true, invoice_id: invoiceId })
    .in('id', expenseIds)

  if (error) {
    throw new Error(error.message || 'Failed to mark expenses as billed')
  }
}
