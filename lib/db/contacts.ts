import { createClient } from '@/lib/supabase/server'
import type { Contact, ContactStatus } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getContacts(
  filters: {
    workstream_id?: string
    account_id?: string
    status?: ContactStatus
    search?: string
  } = {},
  client?: SupabaseClient
): Promise<Contact[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.account_id) {
    query = query.eq('account_id', filters.account_id)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    const search = filters.search.trim()
    if (search) {
      query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%`)
    }
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load contacts')
  }

  return (data ?? []) as Contact[]
}

export async function getContactById(
  id: string,
  client?: SupabaseClient
): Promise<Contact | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load contact')
  }

  return (data as Contact | null) ?? null
}

export async function createContact(
  data: Omit<Contact, 'id' | 'created_at' | 'updated_at'>,
  client?: SupabaseClient
): Promise<Contact> {
  const supabase = await getSupabase(client)
  const payload = {
    ...data,
    name: data.name.trim(),
  }

  if (!payload.name) {
    throw new Error('name is required')
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create contact')
  }

  return contact as Contact
}

export async function updateContact(
  id: string,
  data: Partial<Contact>,
  client?: SupabaseClient
): Promise<Contact> {
  const supabase = await getSupabase(client)
  const patch = { ...data }

  if (patch.name !== undefined) {
    patch.name = patch.name.trim()
    if (!patch.name) {
      throw new Error('name is required')
    }
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update contact')
  }

  return contact as Contact
}

export async function deleteContact(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('contacts').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete contact')
  }
}
