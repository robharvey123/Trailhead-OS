import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus, PricingTier } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type InvoiceRow = Invoice & {
  pricing_tiers: PricingTier | null
}

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    ...row,
    pricing_tier: row.pricing_tiers ?? undefined,
  }
}

export async function getInvoices(
  filters: { status?: InvoiceStatus; workstream_id?: string; account_id?: string } = {},
  client?: SupabaseClient
): Promise<Invoice[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('invoices')
    .select('*, pricing_tiers(*)')
    .order('issue_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load invoices')
  }

  return ((data ?? []) as InvoiceRow[]).map(mapInvoice)
}

export async function getInvoiceById(
  id: string,
  client?: SupabaseClient
): Promise<Invoice | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('invoices')
    .select('*, pricing_tiers(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load invoice')
  }

  return data ? mapInvoice(data as InvoiceRow) : null
}

export async function createInvoice(
  data: Omit<Invoice, 'id' | 'invoice_number' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<Invoice> {
  const supabase = await getSupabase(client)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert(data)
    .select('*, pricing_tiers(*)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create invoice')
  }

  return mapInvoice(invoice as InvoiceRow)
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
    .select('*, pricing_tiers(*)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update invoice')
  }

  return mapInvoice(invoice as InvoiceRow)
}
