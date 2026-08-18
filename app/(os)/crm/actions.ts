'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { matchMeeting } from '@/lib/meetings/match'
import { getMeetingNote, updateMeetingNoteLinks } from '@/lib/db/meeting-notes'
import { syncGranolaMeetings } from '@/lib/granola-sync'

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
      supabase.from('accounts').select('id, website, email_contact').eq('record_type', 'sales'),
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

/**
 * Manually trigger a Granola sync from the Meetings page ("Sync now"). Runs the
 * same shared logic as the hourly cron. The sync itself uses the service role,
 * so we gate on an authenticated user here as the authorisation boundary.
 */
export async function syncGranolaNow(): Promise<{ error?: string; synced?: number; linked?: number; rateLimited?: boolean }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authorised' }

    const result = await syncGranolaMeetings()
    revalidatePath('/crm/meetings')
    return { synced: result.synced, linked: result.linked, rateLimited: result.rateLimited }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sync failed' }
  }
}
