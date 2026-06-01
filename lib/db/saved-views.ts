import { createClient } from '@/lib/supabase/server'
import type { SavedView, SavedViewEntity, SavedViewInput } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function listSavedViews(
  entity?: SavedViewEntity,
  client?: SupabaseClient
): Promise<SavedView[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('saved_views')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: true })
  if (entity) query = query.eq('entity', entity)

  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load saved views')
  return (data ?? []) as SavedView[]
}

export async function upsertSavedView(
  input: SavedViewInput,
  client?: SupabaseClient
): Promise<SavedView> {
  const supabase = await getSupabase(client)

  const patch: Record<string, unknown> = {}
  if ('entity' in input) patch.entity = input.entity
  if ('name' in input) patch.name = input.name.trim()
  if ('filters' in input) patch.filters = input.filters ?? {}
  if ('sort' in input) patch.sort = input.sort ?? null
  if ('is_pinned' in input && input.is_pinned !== undefined) patch.is_pinned = input.is_pinned

  if (input.id) {
    const { data, error } = await supabase
      .from('saved_views')
      .update(patch)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message || 'Failed to update saved view')
    return data as SavedView
  }

  const auth = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('saved_views')
    .insert({ filters: {}, ...patch, owner_id: auth.data.user?.id ?? null })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create saved view')
  return data as SavedView
}

export async function deleteSavedView(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('saved_views').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete saved view')
}

export async function pinSavedView(
  id: string,
  isPinned: boolean,
  client?: SupabaseClient
): Promise<SavedView> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('saved_views')
    .update({ is_pinned: isPinned })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to pin saved view')
  return data as SavedView
}
