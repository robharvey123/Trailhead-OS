import { createClient } from '@/lib/supabase/server'
import type { Enquiry, EnquiryStatus } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export async function getEnquiries(
  filters: { status?: EnquiryStatus } = {},
  client?: SupabaseClient
): Promise<Enquiry[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load enquiries')
  }

  return (data ?? []) as Enquiry[]
}

export async function getEnquiryById(
  id: string,
  client?: SupabaseClient
): Promise<Enquiry | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('enquiries')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load enquiry')
  }

  return (data as Enquiry | null) ?? null
}

export async function updateEnquiry(
  id: string,
  data: Partial<Enquiry>,
  client?: SupabaseClient
): Promise<Enquiry> {
  const supabase = await getSupabase(client)
  const { data: enquiry, error } = await supabase
    .from('enquiries')
    .update(data)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update enquiry')
  }

  return enquiry as Enquiry
}
