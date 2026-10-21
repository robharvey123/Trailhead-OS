import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * The OS owner's auth user id, resolved by the DB helper owner_user_id()
 * (the profile with role = 'owner'). Never use "first user from listUsers":
 * that returns whichever auth user sorts first, which is not the owner once
 * there is more than one login. Requires a service-role client.
 */
export async function getOwnerUserId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.rpc('owner_user_id')
  if (error || typeof data !== 'string') return null
  return data
}

export async function getOwnerUser(admin: SupabaseClient): Promise<User | null> {
  const id = await getOwnerUserId(admin)
  if (!id) return null
  const { data, error } = await admin.auth.admin.getUserById(id)
  if (error) return null
  return data.user ?? null
}
