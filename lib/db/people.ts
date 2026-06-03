import { createClient } from '@/lib/supabase/server'
import type { Person } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function listPeople(
  filters: { activeOnly?: boolean } = {},
  client?: SupabaseClient
): Promise<Person[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('people').select('*').order('full_name', { ascending: true })
  if (filters.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load people')
  return (data ?? []) as Person[]
}

export async function getPersonByAuthUser(authUserId: string, client?: SupabaseClient): Promise<Person | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('people').select('*').eq('auth_user_id', authUserId).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load person')
  return (data as Person | null) ?? null
}

export interface CreatePersonInput {
  full_name: string
  email?: string | null
  default_hourly_rate_gbp?: number | null
  auth_user_id?: string | null
}

/**
 * Creates a person. Guards the unique email constraint up-front so a duplicate
 * returns a friendly message instead of a raw Postgres 23505 error.
 */
export async function createPerson(input: CreatePersonInput, client?: SupabaseClient): Promise<Person> {
  const supabase = await getSupabase(client)
  const email = input.email?.trim() || null
  if (email) {
    const { data: existing } = await supabase.from('people').select('id').eq('email', email).maybeSingle()
    if (existing) throw new Error(`A person with the email ${email} already exists.`)
  }
  const { data, error } = await supabase
    .from('people')
    .insert({
      full_name: input.full_name.trim(),
      email,
      default_hourly_rate_gbp: input.default_hourly_rate_gbp ?? null,
      auth_user_id: input.auth_user_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create person')
  return data as Person
}
