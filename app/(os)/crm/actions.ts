'use server'

import { createClient } from '@/lib/supabase/server'
import { matchMeeting } from '@/lib/meetings/match'
import { getMeetingNote, updateMeetingNoteLinks } from '@/lib/db/meeting-notes'

/**
 * Re-run matching for a meeting note against the current CRM data, using the
 * attendee emails stored on the note (no Google round-trip). Runs as the user, so
 * RLS governs what can be read/written. The caller refreshes the page after.
 */
export async function rematchMeetingNote(noteId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    const note = await getMeetingNote(noteId, supabase)
    if (!note) return { error: 'Meeting note not found' }

    const [{ data: accounts }, { data: contacts }, { data: deals }] = await Promise.all([
      supabase.from('accounts').select('id, website, email_contact'),
      supabase.from('contacts').select('id, email, account_id'),
      supabase.from('deals').select('id, account_id, stage, updated_at'),
    ])

    const link = matchMeeting({
      attendeeEmails: note.attendee_emails,
      accounts: accounts ?? [],
      contacts: contacts ?? [],
      deals: deals ?? [],
    })

    await updateMeetingNoteLinks(noteId, link, supabase)
    return {}
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Re-match failed' }
  }
}
