import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { MeetingSource, MeetingSummary, NormalisedMeeting } from '@/lib/meetings/types'
import type { MatchConfidence, MeetingLinkSet } from '@/lib/meetings/match'

// Accept either the SSR server client (user-scoped, RLS) or the service client
// (cron). Both satisfy the bare supabase-js SupabaseClient type.
async function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ?? ((await createClient()) as unknown as SupabaseClient)
}

export interface MeetingNote {
  id: string
  source: MeetingSource
  calendar_event_id: string | null
  account_id: string | null
  deal_id: string | null
  transcript: string | null
  summary: MeetingSummary | null
  attendee_emails: string[]
  match_confidence: MatchConfidence
  needs_review: boolean
  occurred_at: string
  created_at: string
  updated_at: string
}

export interface MeetingNoteWithRelations extends MeetingNote {
  account: { id: string; name: string } | null
  deal: { id: string; name: string } | null
  contactIds: string[]
}

const SELECT =
  '*, account:accounts(id,name), deal:deals(id,name), meeting_notes_contacts(contact_id)'

type RawRow = Record<string, unknown> & {
  account?: { id: string; name: string } | null
  deal?: { id: string; name: string } | null
  meeting_notes_contacts?: Array<{ contact_id: string }> | null
}

function normalize(row: RawRow): MeetingNoteWithRelations {
  const { meeting_notes_contacts, account, deal, ...rest } = row
  return {
    ...(rest as unknown as MeetingNote),
    account: account ?? null,
    deal: deal ?? null,
    contactIds: (meeting_notes_contacts ?? []).map((r) => r.contact_id),
  }
}

/** Reconcile a note's contact links to exactly `contactIds` (delete-then-insert). */
async function syncContacts(
  supabase: SupabaseClient,
  noteId: string,
  contactIds: string[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('meeting_notes_contacts')
    .delete()
    .eq('meeting_note_id', noteId)
  if (delError) throw new Error(delError.message || 'Failed to update meeting-note contacts')

  const unique = Array.from(new Set(contactIds.filter(Boolean)))
  if (unique.length === 0) return

  const { error: insError } = await supabase
    .from('meeting_notes_contacts')
    .insert(unique.map((contact_id) => ({ meeting_note_id: noteId, contact_id })))
  if (insError) throw new Error(insError.message || 'Failed to update meeting-note contacts')
}

/** Insert or update (dedupe on calendar_event_id) a meeting note + its contact links. */
export async function upsertMeetingNote(
  meeting: NormalisedMeeting,
  link: MeetingLinkSet,
  client?: SupabaseClient
): Promise<MeetingNote> {
  const supabase = await getSupabase(client)
  const payload = {
    source: meeting.source,
    calendar_event_id: meeting.eventId,
    account_id: link.accountId,
    deal_id: link.dealId,
    transcript: meeting.transcript,
    summary: meeting.summary,
    attendee_emails: meeting.attendees,
    match_confidence: link.confidence,
    needs_review: link.needsReview,
    occurred_at: meeting.occurredAt,
  }
  const { data, error } = await supabase
    .from('meeting_notes')
    .upsert(payload, { onConflict: 'calendar_event_id' })
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to save meeting note')

  const note = data as MeetingNote
  await syncContacts(supabase, note.id, link.contactIds)
  return note
}

/** Re-apply a fresh match to an existing note (used by the manual re-match control). */
export async function updateMeetingNoteLinks(
  noteId: string,
  link: MeetingLinkSet,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('meeting_notes')
    .update({
      account_id: link.accountId,
      deal_id: link.dealId,
      match_confidence: link.confidence,
      needs_review: link.needsReview,
    })
    .eq('id', noteId)
  if (error) throw new Error(error.message || 'Failed to re-match meeting note')
  await syncContacts(supabase, noteId, link.contactIds)
}

export async function getMeetingNote(
  id: string,
  client?: SupabaseClient
): Promise<MeetingNoteWithRelations | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase.from('meeting_notes').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message || 'Failed to load meeting note')
  return data ? normalize(data as RawRow) : null
}

export async function listMeetingNotesForAccount(
  accountId: string,
  client?: SupabaseClient
): Promise<MeetingNoteWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('meeting_notes')
    .select(SELECT)
    .eq('account_id', accountId)
    .order('occurred_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load meeting notes')
  return (data ?? []).map((r) => normalize(r as RawRow))
}

export async function listMeetingNotesForContact(
  contactId: string,
  client?: SupabaseClient
): Promise<MeetingNoteWithRelations[]> {
  const supabase = await getSupabase(client)
  const { data: links, error: linkError } = await supabase
    .from('meeting_notes_contacts')
    .select('meeting_note_id')
    .eq('contact_id', contactId)
  if (linkError) throw new Error(linkError.message || 'Failed to load meeting notes')
  const ids = (links ?? []).map((l) => l.meeting_note_id as string)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('meeting_notes')
    .select(SELECT)
    .in('id', ids)
    .order('occurred_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load meeting notes')
  return (data ?? []).map((r) => normalize(r as RawRow))
}
