import { createClient } from '@/lib/supabase/server'
import {
  calculateTotals as calculateInvoiceTotals,
  type Account,
  type Contact,
  type Enquiry,
  type Invoice,
  type PricingTier,
  type InvoiceTotals,
  type ProjectStatus,
  type Quote,
  type QuoteListItem,
  type QuoteLineItem,
  type QuoteStatus,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type QuoteRow = Quote & {
  accounts: Account | null
  contacts: Contact | null
  enquiries: Enquiry | null
  pricing_tiers: PricingTier | null
  projects: { id: string; name: string; status: ProjectStatus } | null
  workstreams: { label: string; colour: string } | null
}

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapQuote(row: QuoteRow): QuoteListItem {
  return {
    ...row,
    account: row.accounts ?? undefined,
    account_name: row.accounts?.name ?? null,
    contact: row.contacts ?? undefined,
    contact_name: row.contacts?.name ?? null,
    contact_company: row.contacts?.company ?? null,
    pricing_tier: row.pricing_tiers ?? undefined,
    project: row.projects ?? undefined,
    workstream: row.workstreams ?? undefined,
    enquiry: row.enquiries ?? undefined,
    invoice: null,
    totals: calculateTotals(row.line_items ?? [], row.vat_rate),
  }
}

export function calculateTotals(
  line_items: QuoteLineItem[],
  vat_rate: number
): InvoiceTotals {
  return calculateInvoiceTotals(line_items, vat_rate)
}

export async function getQuotes(
  filters: {
    status?: QuoteStatus
    workstream_id?: string
    account_id?: string
    project_id?: string
  } = {},
  client?: SupabaseClient
): Promise<QuoteListItem[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('quotes')
    .select('*, accounts(*), contacts(*), enquiries(*), pricing_tiers(*), projects(id, name, status), workstreams(label, colour)')
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

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load quotes')
  }

  const rows = (data ?? []) as QuoteRow[]
  const invoiceIds = rows
    .map((row) => row.converted_invoice_id)
    .filter((value): value is string => Boolean(value))

  const invoicesById = new Map<string, Invoice>()

  if (invoiceIds.length > 0) {
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .in('id', invoiceIds)

    if (invoicesError) {
      throw new Error(invoicesError.message || 'Failed to load converted invoices')
    }

    for (const invoice of invoices ?? []) {
      invoicesById.set(invoice.id, invoice as Invoice)
    }
  }

  return rows.map((row) => ({
    ...mapQuote(row),
    invoice: row.converted_invoice_id ? invoicesById.get(row.converted_invoice_id) ?? null : null,
  }))
}

export async function getQuoteById(
  id: string,
  client?: SupabaseClient
): Promise<QuoteListItem | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('quotes')
    .select('*, accounts(*), contacts(*), enquiries(*), pricing_tiers(*), projects(id, name, status), workstreams(label, colour)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load quote')
  }

  if (!data) {
    return null
  }

  let invoice: Invoice | null = null
  if (data.converted_invoice_id) {
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', data.converted_invoice_id)
      .maybeSingle()

    if (invoiceError) {
      throw new Error(invoiceError.message || 'Failed to load converted invoice')
    }

    invoice = (invoiceData as Invoice | null) ?? null
  }

  return {
    ...mapQuote(data as QuoteRow),
    invoice,
  }
}

type QuoteMutationInput = Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'> | Partial<Quote>

function sanitizeText(value: string | undefined) {
  return value?.trim() || null
}

function sanitizeQuotePayload(data: QuoteMutationInput) {
  const payload: Record<string, unknown> = {}

  if ('account_id' in data) payload.account_id = data.account_id ?? null
  if ('contact_id' in data) payload.contact_id = data.contact_id ?? null
  if ('workstream_id' in data) payload.workstream_id = data.workstream_id ?? null
  if ('enquiry_id' in data) payload.enquiry_id = data.enquiry_id ?? null
  if ('project_id' in data) payload.project_id = data.project_id ?? null
  if ('pricing_tier_id' in data) payload.pricing_tier_id = data.pricing_tier_id ?? null
  if ('status' in data) payload.status = data.status
  if ('pricing_type' in data) payload.pricing_type = data.pricing_type
  if ('title' in data) payload.title = typeof data.title === 'string' ? data.title.trim() : data.title
  if ('summary' in data) payload.summary = sanitizeText(data.summary)
  if ('estimated_hours' in data) payload.estimated_hours = data.estimated_hours ?? null
  if ('estimated_timeline' in data) payload.estimated_timeline = sanitizeText(data.estimated_timeline)
  if ('scope' in data) payload.scope = data.scope ?? []
  if ('line_items' in data) payload.line_items = data.line_items ?? []
  if ('vat_rate' in data) payload.vat_rate = data.vat_rate ?? 20
  if ('valid_until' in data) payload.valid_until = data.valid_until ?? null
  if ('payment_terms' in data) {
    payload.payment_terms =
      sanitizeText(data.payment_terms) ??
      'Payment terms: 50% deposit on acceptance, 50% on completion.'
  }
  if ('notes' in data) payload.notes = sanitizeText(data.notes)
  if ('complexity_breakdown' in data) {
    payload.complexity_breakdown = data.complexity_breakdown ?? null
  }
  if ('converted_invoice_id' in data) payload.converted_invoice_id = data.converted_invoice_id ?? null
  if ('ai_generated' in data) payload.ai_generated = data.ai_generated ?? false
  if ('ai_generated_at' in data) payload.ai_generated_at = data.ai_generated_at ?? null
  if ('issue_date' in data) payload.issue_date = data.issue_date

  return payload
}

export async function createQuote(
  data: Omit<Quote, 'id' | 'quote_number' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<QuoteListItem> {
  const supabase = await getSupabase(client)
  const payload = sanitizeQuotePayload(data) as Record<string, unknown>

  if (!payload.title) {
    throw new Error('title is required')
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert(payload)
    .select('*, accounts(*), contacts(*), enquiries(*), pricing_tiers(*), projects(id, name, status), workstreams(label, colour)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create quote')
  }

  return mapQuote(quote as QuoteRow)
}

export async function updateQuote(
  id: string,
  data: Partial<Quote>,
  client?: SupabaseClient
): Promise<QuoteListItem> {
  const supabase = await getSupabase(client)
  const patch = sanitizeQuotePayload(data) as Record<string, unknown>

  if (patch.title !== undefined && !patch.title) {
    throw new Error('title is required')
  }

  const { data: quote, error } = await supabase
    .from('quotes')
    .update(patch)
    .eq('id', id)
    .select('*, accounts(*), contacts(*), enquiries(*), pricing_tiers(*), projects(id, name, status), workstreams(label, colour)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update quote')
  }

  return mapQuote(quote as QuoteRow)
}
