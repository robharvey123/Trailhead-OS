import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getInvoices(
  filters: { status?: InvoiceStatus; workstream_id?: string } = {},
  client?: SupabaseClient
): Promise<Invoice[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('invoices')
    .select('*')
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load invoices')
  }

  return (data ?? []) as Invoice[]
}

export async function getInvoiceById(
  id: string,
  client?: SupabaseClient
): Promise<Invoice | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load invoice')
  }

  return (data as Invoice | null) ?? null
}

export async function createInvoice(
  data: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<Invoice> {
  const supabase = await getSupabase(client)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(data)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create invoice')
  }

  return invoice as Invoice
}

export async function updateInvoice(
  id: string,
  data: Partial<Invoice>,
  client?: SupabaseClient
): Promise<Invoice> {
  const supabase = await getSupabase(client)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update invoice')
  }

  return invoice as Invoice
}
