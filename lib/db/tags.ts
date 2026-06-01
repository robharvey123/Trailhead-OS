import { createClient } from '@/lib/supabase/server'
import type { Tag, TagColor } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function listTags(client?: SupabaseClient): Promise<Tag[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true })
  if (error) throw new Error(error.message || 'Failed to load tags')
  return (data ?? []) as Tag[]
}

export async function upsertTag(
  input: { id?: string; name: string; color?: TagColor },
  client?: SupabaseClient
): Promise<Tag> {
  const supabase = await getSupabase(client)
  const payload = { name: input.name.trim(), color: input.color ?? 'accent' }

  if (input.id) {
    const { data, error } = await supabase
      .from('tags')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message || 'Failed to update tag')
    return data as Tag
  }

  const { data, error } = await supabase
    .from('tags')
    .upsert(payload, { onConflict: 'name' })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create tag')
  return data as Tag
}

export async function deleteTag(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete tag')
}

/** All account→tag links as a map keyed by account_id (for list rendering). */
export async function accountTagMap(
  client?: SupabaseClient
): Promise<Record<string, Tag[]>> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('account_tags').select('account_id, tag:tags(*)')
  if (error) throw new Error(error.message || 'Failed to load account tags')
  const map: Record<string, Tag[]> = {}
  for (const row of (data ?? []) as unknown as Array<{ account_id: string; tag: Tag }>) {
    if (!row.tag) continue
    ;(map[row.account_id] ??= []).push(row.tag)
  }
  return map
}

export async function tagsForAccount(accountId: string, client?: SupabaseClient): Promise<Tag[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('account_tags')
    .select('tag:tags(*)')
    .eq('account_id', accountId)
  if (error) throw new Error(error.message || 'Failed to load account tags')
  return (data ?? []).map((row) => (row as unknown as { tag: Tag }).tag).filter(Boolean)
}

export async function tagsForDeal(dealId: string, client?: SupabaseClient): Promise<Tag[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('deal_tags').select('tag:tags(*)').eq('deal_id', dealId)
  if (error) throw new Error(error.message || 'Failed to load deal tags')
  return (data ?? []).map((row) => (row as unknown as { tag: Tag }).tag).filter(Boolean)
}

export async function tagAccount(
  accountId: string,
  tagId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('account_tags')
    .upsert({ account_id: accountId, tag_id: tagId }, { onConflict: 'account_id,tag_id' })
  if (error) throw new Error(error.message || 'Failed to tag account')
}

export async function untagAccount(
  accountId: string,
  tagId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('account_tags')
    .delete()
    .eq('account_id', accountId)
    .eq('tag_id', tagId)
  if (error) throw new Error(error.message || 'Failed to untag account')
}

export async function tagDeal(dealId: string, tagId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('deal_tags')
    .upsert({ deal_id: dealId, tag_id: tagId }, { onConflict: 'deal_id,tag_id' })
  if (error) throw new Error(error.message || 'Failed to tag deal')
}

export async function untagDeal(
  dealId: string,
  tagId: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('deal_tags').delete().eq('deal_id', dealId).eq('tag_id', tagId)
  if (error) throw new Error(error.message || 'Failed to untag deal')
}
