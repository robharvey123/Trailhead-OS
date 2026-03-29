import { createClient } from '@/lib/supabase/server'
import type { Touchpoint } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

function sanitizeText(value: string | null | undefined) {
  return value?.trim() || null
}

function sanitizePayload(data: Partial<Touchpoint>) {
  const payload: Record<string, unknown> = {}

  if ('account_id' in data) payload.account_id = data.account_id ?? null
  if ('contact_id' in data) payload.contact_id = data.contact_id ?? null
  if ('type' in data) payload.type = data.type
  if ('subject' in data) payload.subject = typeof data.subject === 'string' ? data.subject.trim() : data.subject
  if ('body' in data) payload.body = sanitizeText(data.body)
  if ('occurred_at' in data) payload.occurred_at = data.occurred_at

  return payload
}

export async function getTouchpoints(
  filters: {
    account_id?: string
    contact_id?: string
  } = {},
  client?: SupabaseClient
): Promise<Touchpoint[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('touchpoints')
    .select('*')
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.contact_id) {
    query = query.eq('contact_id', filters.contact_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load touchpoints')
  }

  return (data ?? []) as Touchpoint[]
}

export async function createTouchpoint(
  data: Omit<Touchpoint, 'id' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<Touchpoint> {
  const supabase = await getSupabase(client)
  const payload = sanitizePayload(data)

  if (!payload.subject) {
    throw new Error('subject is required')
  }

  const { data: touchpoint, error } = await supabase
    .from('touchpoints')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create touchpoint')
  }

  return touchpoint as Touchpoint
}

export async function deleteTouchpoint(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('touchpoints')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete touchpoint')
  }
}
