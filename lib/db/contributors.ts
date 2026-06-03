import { createClient } from '@/lib/supabase/server'
import type { EngagementContributor, EngagementContributorWithPerson } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const CONTRIBUTOR_SELECT = '*, person:people(id, full_name, email)'

export async function listContributors(
  engagementId: string,
  client?: SupabaseClient
): Promise<EngagementContributorWithPerson[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_contributors')
    .select(CONTRIBUTOR_SELECT)
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load contributors')
  return (data ?? []) as unknown as EngagementContributorWithPerson[]
}

/** The active contributor rate for a (engagement, person) pair, or null if not a contributor. */
export async function contributorRate(
  engagementId: string,
  personId: string,
  client?: SupabaseClient
): Promise<number | null> {
  const supabase = await getSupabase(client)
  const { data } = await supabase
    .from('engagement_contributors')
    .select('hourly_rate_gbp')
    .eq('engagement_id', engagementId)
    .eq('person_id', personId)
    .eq('is_active', true)
    .maybeSingle()
  return data ? Number(data.hourly_rate_gbp) : null
}

export interface AddContributorInput {
  engagement_id: string
  person_id: string
  role?: string | null
  hourly_rate_gbp: number
}

/**
 * Adds a contributor to an engagement, snapshotting the rate. The rate is stored
 * here verbatim — it is NOT re-derived from people.default_hourly_rate_gbp later,
 * so changing a person's default rate never alters historical engagement rates.
 */
export async function addContributor(
  input: AddContributorInput,
  client?: SupabaseClient
): Promise<EngagementContributorWithPerson> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('engagement_contributors')
    .insert({
      engagement_id: input.engagement_id,
      person_id: input.person_id,
      role: input.role?.trim() || null,
      hourly_rate_gbp: input.hourly_rate_gbp,
      is_active: true,
    })
    .select(CONTRIBUTOR_SELECT)
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('That person is already a contributor on this engagement.')
    throw new Error(error.message || 'Failed to add contributor')
  }
  return data as unknown as EngagementContributorWithPerson
}

export async function updateContributor(
  id: string,
  patch: Partial<Pick<EngagementContributor, 'role' | 'hourly_rate_gbp' | 'is_active'>>,
  client?: SupabaseClient
): Promise<EngagementContributorWithPerson> {
  const supabase = await getSupabase(client)
  const update: Record<string, unknown> = {}
  if ('role' in patch) update.role = patch.role?.trim() || null
  if ('hourly_rate_gbp' in patch && patch.hourly_rate_gbp != null) update.hourly_rate_gbp = patch.hourly_rate_gbp
  if ('is_active' in patch && patch.is_active != null) update.is_active = patch.is_active
  const { data, error } = await supabase
    .from('engagement_contributors')
    .update(update)
    .eq('id', id)
    .select(CONTRIBUTOR_SELECT)
    .single()
  if (error) throw new Error(error.message || 'Failed to update contributor')
  return data as unknown as EngagementContributorWithPerson
}

export const deactivateContributor = (id: string, client?: SupabaseClient) =>
  updateContributor(id, { is_active: false }, client)
