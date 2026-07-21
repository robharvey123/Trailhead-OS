import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Accept either the SSR server client (user-scoped, RLS) or the service client.
async function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ?? ((await createClient()) as unknown as SupabaseClient)
}

export interface MeetingAttendee {
  name: string | null
  email: string
}

export interface Meeting {
  id: string
  granola_note_id: string
  title: string
  summary_md: string | null
  meeting_date: string | null
  attendees: MeetingAttendee[]
  account_id: string | null
  created_at: string
  updated_at: string
}

export interface MeetingWithRelations extends Meeting {
  account: { id: string; name: string } | null
  contactIds: string[]
}

const SELECT = '*, account:accounts(id,name), meeting_contacts(contact_id)'

type RawRow = Record<string, unknown> & {
  account?: { id: string; name: string } | null
  meeting_contacts?: Array<{ contact_id: string }> | null
}

function normalize(row: RawRow): MeetingWithRelations {
  const { meeting_contacts, account, ...rest } = row
  return {
    ...(rest as unknown as Meeting),
    account: account ?? null,
    contactIds: (meeting_contacts ?? []).map((r) => r.contact_id),
  }
}

/** All meetings, newest meeting first, for the Meetings list page. */
export async function listMeetings(client?: SupabaseClient): Promise<MeetingWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('meetings')
    .select(SELECT)
    .order('meeting_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message || 'Failed to load meetings')
  return (data ?? []).map((r) => normalize(r as RawRow))
}

export async function getMeeting(
  id: string,
  client?: SupabaseClient
): Promise<MeetingWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('meetings').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load meeting')
  return data ? normalize(data as RawRow) : null
}

export async function listMeetingsForAccount(
  accountId: string,
  client?: SupabaseClient
): Promise<MeetingWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('meetings')
    .select(SELECT)
    .eq('account_id', accountId)
    .order('meeting_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message || 'Failed to load meetings')
  return (data ?? []).map((r) => normalize(r as RawRow))
}

export async function listMeetingsForContact(
  contactId: string,
  client?: SupabaseClient
): Promise<MeetingWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data: links, error: linkError } = await supabase
    .from('meeting_contacts')
    .select('meeting_id')
    .eq('contact_id', contactId)
  if (linkError) throw new Error(linkError.message || 'Failed to load meetings')
  const ids = (links ?? []).map((l) => l.meeting_id as string)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('meetings')
    .select(SELECT)
    .in('id', ids)
    .order('meeting_date', { ascending: false, nullsFirst: false })
  if (error) throw new Error(error.message || 'Failed to load meetings')
  return (data ?? []).map((r) => normalize(r as RawRow))
}
