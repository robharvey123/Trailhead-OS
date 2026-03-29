import { createClient } from '@/lib/supabase/server'
import type {
  Account,
  AccountStatus,
  AccountWithRelations,
  Contact,
  Enquiry,
  Invoice,
  QuoteStatus,
  QuoteWithRelations,
  TaskWithWorkstream,
  Touchpoint,
} from '@/lib/types'
import type { QuoteListItem } from '@/lib/types'
import { getQuoteById } from './quotes'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type AccountRow = Account & {
  workstreams: { label: string; colour: string } | null
}

type ContactAccountRow = Contact

export interface AccountListItem extends AccountWithRelations {
  contacts_count: number
  latest_quote_status: QuoteStatus | null
}

export interface AccountDetail extends AccountWithRelations {
  recent_quotes: QuoteWithRelations[]
  recent_tasks: TaskWithWorkstream[]
  invoices: Invoice[]
  source_enquiry: Enquiry | null
  touchpoints: Touchpoint[]
}

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function mapAccount(row: AccountRow): AccountWithRelations {
  return {
    ...row,
    workstream: row.workstreams ?? undefined,
    contacts: undefined,
    quotes: undefined,
  }
}

export async function getAccounts(
  filters: {
    workstream_id?: string
    status?: AccountStatus
    search?: string
  } = {},
  client?: SupabaseClient
): Promise<AccountListItem[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('accounts')
    .select('*, workstreams(label, colour)')
    .order('created_at', { ascending: false })

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search?.trim()) {
    const search = filters.search.trim()
    query = query.or(`name.ilike.%${search}%,website.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load accounts')
  }

  const rows = (data ?? []) as AccountRow[]
  const accountIds = rows.map((row) => row.id)

  if (accountIds.length === 0) {
    return []
  }

  const [contactsResult, quotesResult] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, account_id')
      .in('account_id', accountIds),
    supabase
      .from('quotes')
      .select('id, account_id, status, created_at, issue_date')
      .in('account_id', accountIds)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (contactsResult.error) {
    throw new Error(contactsResult.error.message || 'Failed to load account contacts')
  }

  if (quotesResult.error) {
    throw new Error(quotesResult.error.message || 'Failed to load account quotes')
  }

  const contactCounts = new Map<string, number>()
  for (const contact of contactsResult.data ?? []) {
    if (!contact.account_id) continue
    contactCounts.set(contact.account_id, (contactCounts.get(contact.account_id) ?? 0) + 1)
  }

  const latestStatuses = new Map<string, QuoteStatus | null>()
  for (const quote of quotesResult.data ?? []) {
    if (!quote.account_id || latestStatuses.has(quote.account_id)) {
      continue
    }
    latestStatuses.set(quote.account_id, quote.status as QuoteStatus)
  }

  return rows.map((row) => ({
    ...mapAccount(row),
    contacts_count: contactCounts.get(row.id) ?? 0,
    latest_quote_status: latestStatuses.get(row.id) ?? null,
  }))
}

export async function getAccountById(
  id: string,
  client?: SupabaseClient
): Promise<AccountDetail | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('accounts')
    .select('*, workstreams(label, colour)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load account')
  }

  if (!data) {
    return null
  }

  const [contactsResult, tasksResult, quotesResult, invoicesResult, enquiryResult, touchpointsResult] = await Promise.all([
    supabase
      .from('contacts')
      .select('*')
      .eq('account_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*, workstreams(slug, label, colour)')
      .eq('account_id', id)
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('quotes')
      .select('id')
      .eq('account_id', id)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('invoices')
      .select('*')
      .eq('account_id', id)
      .order('issue_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('enquiries')
      .select('*')
      .eq('account_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('touchpoints')
      .select('*')
      .eq('account_id', id)
      .order('occurred_at', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (contactsResult.error) {
    throw new Error(contactsResult.error.message || 'Failed to load account contacts')
  }

  if (tasksResult.error) {
    throw new Error(tasksResult.error.message || 'Failed to load account tasks')
  }

  if (quotesResult.error) {
    throw new Error(quotesResult.error.message || 'Failed to load account quotes')
  }

  if (invoicesResult.error) {
    throw new Error(invoicesResult.error.message || 'Failed to load account invoices')
  }

  if (enquiryResult.error) {
    throw new Error(enquiryResult.error.message || 'Failed to load linked enquiry')
  }

  if (touchpointsResult.error) {
    throw new Error(touchpointsResult.error.message || 'Failed to load account touchpoints')
  }

  const recentQuotes = await Promise.all(
    (quotesResult.data ?? []).map(async (quote) => getQuoteById(quote.id, supabase))
  )
  const resolvedQuotes = recentQuotes.filter(
    (quote): quote is QuoteListItem => quote !== null
  )

  return {
    ...mapAccount(data as AccountRow),
    contacts: (contactsResult.data ?? []) as ContactAccountRow[],
    quotes: resolvedQuotes,
    recent_quotes: resolvedQuotes,
    recent_tasks: (tasksResult.data ?? []) as TaskWithWorkstream[],
    invoices: (invoicesResult.data ?? []) as Invoice[],
    source_enquiry: (enquiryResult.data as Enquiry | null) ?? null,
    touchpoints: (touchpointsResult.data ?? []) as Touchpoint[],
  }
}

type AccountMutationInput = Omit<Account, 'id' | 'created_at' | 'updated_at'> | Partial<Account>

function sanitizeAccountPayload(data: AccountMutationInput) {
  const payload: Record<string, unknown> = {}

  if ('name' in data) {
    payload.name = typeof data.name === 'string' ? data.name.trim() : data.name
  }

  if ('website' in data) payload.website = data.website?.trim() || null
  if ('industry' in data) payload.industry = data.industry?.trim() || null
  if ('size' in data) payload.size = data.size ?? null
  if ('workstream_id' in data) payload.workstream_id = data.workstream_id ?? null
  if ('status' in data) payload.status = data.status
  if ('address_line1' in data) payload.address_line1 = data.address_line1?.trim() || null
  if ('address_line2' in data) payload.address_line2 = data.address_line2?.trim() || null
  if ('city' in data) payload.city = data.city?.trim() || null
  if ('postcode' in data) payload.postcode = data.postcode?.trim() || null
  if ('country' in data) payload.country = data.country?.trim() || 'UK'
  if ('notes' in data) payload.notes = data.notes?.trim() || null
  if ('tags' in data) payload.tags = data.tags ?? []

  return payload
}

export async function createAccount(
  data: Omit<Account, 'id' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<AccountWithRelations> {
  const supabase = await getSupabase(client)
  const payload = sanitizeAccountPayload(data) as Record<string, unknown>

  if (!payload.name) {
    throw new Error('name is required')
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .insert(payload)
    .select('*, workstreams(label, colour)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create account')
  }

  return mapAccount(account as AccountRow)
}

export async function updateAccount(
  id: string,
  data: Partial<Account>,
  client?: SupabaseClient
): Promise<AccountWithRelations> {
  const supabase = await getSupabase(client)
  const patch = sanitizeAccountPayload(data) as Record<string, unknown>

  if (patch.name !== undefined && !patch.name) {
    throw new Error('name is required')
  }

  const { data: account, error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', id)
    .select('*, workstreams(label, colour)')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update account')
  }

  return mapAccount(account as AccountRow)
}

export async function deleteAccount(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('accounts').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete account')
  }
}
