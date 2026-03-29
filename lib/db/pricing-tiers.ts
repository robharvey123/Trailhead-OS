import { createClient } from '@/lib/supabase/server'
import type { PricingTier } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type AllowedUpdateField =
  | 'description'
  | 'hourly_rate'
  | 'day_rate'
  | 'monthly_retainer'
  | 'hosting_maintenance'
  | 'fixed_fee_margin'
  | 'is_default'

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function sanitizeUpdatePayload(data: Partial<PricingTier>) {
  const payload: Partial<Record<AllowedUpdateField, string | number | boolean | null>> = {}

  if ('description' in data) {
    payload.description = typeof data.description === 'string' ? data.description.trim() || null : null
  }

  for (const key of [
    'hourly_rate',
    'day_rate',
    'monthly_retainer',
    'hosting_maintenance',
    'fixed_fee_margin',
  ] as const) {
    if (key in data && data[key] !== undefined) {
      payload[key] = Number(data[key])
    }
  }

  if ('is_default' in data && data.is_default !== undefined) {
    payload.is_default = Boolean(data.is_default)
  }

  return payload
}

async function applyDefaultTierUpdate(
  id: string,
  isDefault: boolean,
  supabase: SupabaseClient
) {
  if (!isDefault) {
    return
  }

  const { error: clearError } = await supabase
    .from('pricing_tiers')
    .update({ is_default: false })
    .neq('id', id)

  if (clearError) {
    throw new Error(clearError.message || 'Failed to update pricing tiers')
  }
}

export async function getPricingTiers(client?: SupabaseClient): Promise<PricingTier[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load pricing tiers')
  }

  return (data ?? []) as PricingTier[]
}

export async function getPricingTierById(
  id: string,
  client?: SupabaseClient
): Promise<PricingTier | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load pricing tier')
  }

  return (data as PricingTier | null) ?? null
}

export async function getPricingTierBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<PricingTier | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('pricing_tiers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load pricing tier')
  }

  return (data as PricingTier | null) ?? null
}

export async function updatePricingTier(
  id: string,
  data: Partial<PricingTier>,
  client?: SupabaseClient
): Promise<PricingTier> {
  const supabase = await getSupabase(client)
  const patch = sanitizeUpdatePayload(data)

  if (Object.keys(patch).length === 0) {
    throw new Error('No supported pricing tier fields supplied')
  }

  for (const key of [
    'hourly_rate',
    'day_rate',
    'monthly_retainer',
    'hosting_maintenance',
    'fixed_fee_margin',
  ] as const) {
    if (patch[key] !== undefined && !Number.isFinite(Number(patch[key]))) {
      throw new Error(`${key} must be numeric`)
    }
  }

  await applyDefaultTierUpdate(id, patch.is_default === true, supabase)

  const { data: tier, error } = await supabase
    .from('pricing_tiers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update pricing tier')
  }

  return tier as PricingTier
}
