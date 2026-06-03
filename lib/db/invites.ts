import { createClient } from '@/lib/supabase/server'
import type { Invite, UserRole } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function listInvites(
  opts: { pendingOnly?: boolean } = {},
  client?: SupabaseClient
): Promise<Invite[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('invites').select('*').order('created_at', { ascending: false })
  if (opts.pendingOnly) query = query.is('claimed_at', null)
  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load invites')
  return (data ?? []) as Invite[]
}

export async function createInvite(
  input: { email: string; role: UserRole; person_id?: string | null; invited_by?: string | null },
  client?: SupabaseClient
): Promise<Invite> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('invites')
    .insert({ email: input.email, role: input.role, person_id: input.person_id ?? null, invited_by: input.invited_by ?? null })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create invite')
  return data as Invite
}

/** "Revoke" = expire immediately, so a pending invite can no longer be claimed. */
export async function revokeInvite(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('invites').update({ expires_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message || 'Failed to revoke invite')
}
