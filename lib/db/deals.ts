import { createClient } from '@/lib/supabase/server'
import type {
  Deal,
  DealForecastBucket,
  DealInput,
  DealStage,
  DealWithRelations,
  PipelineStageSummary,
} from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const DEAL_SELECT = '*, account:accounts(id,name), primary_contact:contacts(id,name)'

const TERMINAL_STAGES: DealStage[] = ['Won', 'Lost']

function isTerminal(stage: DealStage) {
  return TERMINAL_STAGES.includes(stage)
}

export interface DealFilters {
  account_id?: string
  stage?: DealStage
  owner_id?: string
  search?: string
}

export async function listDeals(
  filters: DealFilters = {},
  client?: SupabaseClient
): Promise<DealWithRelations[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('deals').select(DEAL_SELECT).order('updated_at', { ascending: false })

  if (filters.account_id) query = query.eq('account_id', filters.account_id)
  if (filters.stage) query = query.eq('stage', filters.stage)
  if (filters.owner_id) query = query.eq('owner_id', filters.owner_id)
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load deals')
  return (data ?? []) as unknown as DealWithRelations[]
}

export async function getDeal(
  id: string,
  client?: SupabaseClient
): Promise<DealWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('deals').select(DEAL_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load deal')
  return (data as unknown as DealWithRelations | null) ?? null
}

/** Insert (no id) or update (with id) a deal. Stamps closed_at on terminal stages. */
export async function upsertDeal(input: DealInput, client?: SupabaseClient): Promise<Deal> {
  const supabase = await getSupabase(client)

  const patch: Record<string, unknown> = {}
  if ('account_id' in input) patch.account_id = input.account_id
  if ('primary_contact_id' in input) patch.primary_contact_id = input.primary_contact_id ?? null
  if ('name' in input) patch.name = input.name?.trim()
  if ('value_amount' in input) patch.value_amount = input.value_amount ?? null
  if ('value_currency' in input) patch.value_currency = input.value_currency || 'GBP'
  if ('probability' in input && input.probability !== undefined) patch.probability = input.probability
  if ('expected_close_date' in input) patch.expected_close_date = input.expected_close_date || null
  if ('source' in input) patch.source = input.source?.trim() || null
  if ('notes' in input) patch.notes = input.notes?.trim() || null

  if ('stage' in input && input.stage) {
    patch.stage = input.stage
    // Stamp / clear closed_at to match the stage transition.
    patch.closed_at = isTerminal(input.stage) ? new Date().toISOString() : null
  }

  if (input.id) {
    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message || 'Failed to update deal')
    return data as Deal
  }

  const auth = await supabase.auth.getUser()
  const payload = {
    stage: 'New' as DealStage,
    value_currency: 'GBP',
    probability: 10,
    ...patch,
    owner_id: auth.data.user?.id ?? null,
  }

  const { data, error } = await supabase.from('deals').insert(payload).select('*').single()
  if (error) throw new Error(error.message || 'Failed to create deal')
  return data as Deal
}

export async function moveDealStage(
  id: string,
  stage: DealStage,
  client?: SupabaseClient
): Promise<Deal> {
  return upsertDeal({ id, stage } as DealInput, client)
}

export async function closeDeal(
  id: string,
  outcome: 'Won' | 'Lost',
  closedAt?: string,
  client?: SupabaseClient
): Promise<Deal> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('deals')
    .update({ stage: outcome, closed_at: closedAt || new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to close deal')
  return data as Deal
}

export async function deleteDeal(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('deals').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete deal')
}

export async function pipelineSummary(client?: SupabaseClient): Promise<PipelineStageSummary[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('pipeline_summary').select('*')
  if (error) throw new Error(error.message || 'Failed to load pipeline summary')
  return (data ?? []) as PipelineStageSummary[]
}

/**
 * Weighted pipeline forecast (value × probability) bucketed by expected-close month.
 * Excludes Won/Lost. `from`/`to` are ISO dates (YYYY-MM-DD).
 */
export async function forecast(
  range: { from: string; to: string },
  client?: SupabaseClient
): Promise<DealForecastBucket[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('deals')
    .select('expected_close_date,value_amount,probability,stage')
    .gte('expected_close_date', range.from)
    .lte('expected_close_date', range.to)
    .not('stage', 'in', '("Won","Lost")')

  if (error) throw new Error(error.message || 'Failed to load forecast')

  const buckets = new Map<string, DealForecastBucket>()
  for (const row of data ?? []) {
    if (!row.expected_close_date) continue
    const month = String(row.expected_close_date).slice(0, 7)
    const bucket =
      buckets.get(month) ?? { month, deal_count: 0, total_value: 0, weighted_value: 0 }
    const value = Number(row.value_amount) || 0
    const probability = Number(row.probability) || 0
    bucket.deal_count += 1
    bucket.total_value += value
    bucket.weighted_value += value * (probability / 100)
    buckets.set(month, bucket)
  }

  return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month))
}
