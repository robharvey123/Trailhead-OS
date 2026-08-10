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
  /** Primary (auto-linked) account — kept for backward compatibility. */
  account: { id: string; name: string } | null
  /** Full editable set of linked accounts (includes the primary). */
  accounts: { id: string; name: string }[]
  contactIds: string[]
}

const SELECT =
  '*, account:accounts(id,name), meeting_contacts(contact_id), meeting_accounts(account:accounts(id,name))'

type RawRow = Record<string, unknown> & {
  account?: { id: string; name: string } | null
  meeting_contacts?: Array<{ contact_id: string }> | null
  meeting_accounts?: Array<{ account: { id: string; name: string } | null }> | null
}

function normalize(row: RawRow): MeetingWithRelations {
  const { meeting_contacts, meeting_accounts, account, ...rest } = row
  const accounts = (meeting_accounts ?? [])
    .map((r) => r.account)
    .filter((a): a is { id: string; name: string } => !!a)
    .sort((a, b) => a.name.localeCompare(b.name))
  return {
    ...(rest as unknown as Meeting),
    account: account ?? null,
    accounts,
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
  // Via the many-to-many join so a meeting linked to several accounts shows under
  // each. Backfilled from the legacy account_id, so this is a superset of it.
  const { data: links, error: linkError } = await supabase
    .from('meeting_accounts')
    .select('meeting_id')
    .eq('account_id', accountId)
  if (linkError) throw new Error(linkError.message || 'Failed to load meetings')
  const ids = Array.from(new Set((links ?? []).map((l) => l.meeting_id as string)))
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('meetings')
    .select(SELECT)
    .in('id', ids)
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
