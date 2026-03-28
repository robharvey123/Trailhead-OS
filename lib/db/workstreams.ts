import { createClient } from '@/lib/supabase/server'
import type { Workstream } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getWorkstreams(client?: SupabaseClient): Promise<Workstream[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('workstreams')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    throw new Error(error.message || 'Failed to load workstreams')
  }

  return (data ?? []) as Workstream[]
}

export async function getWorkstreamBySlug(
  slug: string,
  client?: SupabaseClient
): Promise<Workstream | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('workstreams')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load workstream')
  }

  return (data as Workstream | null) ?? null
}

