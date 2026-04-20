import { createClient } from '@/lib/supabase/server'
import type { Activity, ActivityType } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getActivities(
  filters: {
    account_id?: string
    contact_id?: string
  } = {},
  client?: SupabaseClient
): Promise<Activity[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('activities')
    .select('*')
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.contact_id) {
    query = query.eq('contact_id', filters.contact_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load activities')
  }

  return (data ?? []) as Activity[]
}

export async function getActivityById(
  id: string,
  client?: SupabaseClient
): Promise<Activity | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load activity')
  }

  return (data as Activity | null) ?? null
}

const ACTIVITY_TYPES = new Set<ActivityType>(['Email', 'Call', 'Meeting', 'Note', 'Task'])

export async function createActivity(
  data: {
    account_id?: string | null
    contact_id?: string | null
    type: string
    subject?: string | null
    notes?: string | null
    activity_date?: string | null
    next_action?: string | null
    next_action_date?: string | null
  },
  client?: SupabaseClient
): Promise<Activity> {
  const supabase = await getSupabase(client)

  if (!data.type || !ACTIVITY_TYPES.has(data.type as ActivityType)) {
    throw new Error('Invalid activity type')
  }

  const payload = {
    account_id: data.account_id ?? null,
    contact_id: data.contact_id ?? null,
    type: data.type,
    subject: data.subject?.trim() || null,
    notes: data.notes?.trim() || null,
    activity_date: data.activity_date || new Date().toISOString().split('T')[0],
    next_action: data.next_action?.trim() || null,
    next_action_date: data.next_action_date || null,
  }

  const { data: activity, error } = await supabase
    .from('activities')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create activity')
  }

  return activity as Activity
}

export async function deleteActivity(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('activities').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete activity')
  }
}
