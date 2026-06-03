import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

const ADMIN_ROLES: UserRole[] = ['owner', 'admin']
const EMPLOYEE_ROLES: UserRole[] = ['owner', 'admin', 'employee']

/** The signed-in user's profile (role, linked person, display name), or null. */
export async function getCurrentProfile(client?: SupabaseClient): Promise<Profile | null> {
  const supabase = await getSupabase(client)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return (data as Profile | null) ?? null
}

/** Role for an arbitrary auth user id — used by middleware where there is no profile in hand. */
export async function getRoleForUser(userId: string, client?: SupabaseClient): Promise<UserRole | null> {
  const supabase = await getSupabase(client)
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  return (data?.role as UserRole | undefined) ?? null
}

export const roleIsAdmin = (role: UserRole | null | undefined) => !!role && ADMIN_ROLES.includes(role)
export const roleIsEmployee = (role: UserRole | null | undefined) => !!role && EMPLOYEE_ROLES.includes(role)

export async function isAdmin(client?: SupabaseClient): Promise<boolean> {
  const profile = await getCurrentProfile(client)
  return roleIsAdmin(profile?.role)
}

/** Throws if the current user is not an admin. Use at the top of admin-only server actions. */
export async function requireAdmin(client?: SupabaseClient): Promise<Profile> {
  const profile = await getCurrentProfile(client)
  if (!profile || !roleIsAdmin(profile.role)) throw new Error('Not authorised')
  return profile
}
