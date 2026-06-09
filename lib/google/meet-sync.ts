import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseService } from '@/lib/supabase/service'
import type { CalendarEvent } from '@/lib/types'
import { matchMeeting } from '@/lib/meetings/match'
import { upsertMeetingNote } from '@/lib/db/meeting-notes'
import { getAllGoogleTokens } from './oauth'
import { fetchMeetArtifacts } from './meet'

export interface MeetSyncResult {
  scanned: number
  ingested: number
  skipped: number
  errors: number
}

/**
 * Poll for recently-ended Google Meet calendar events that have no meeting_note yet,
 * fetch their transcript + Gemini summary, match to account/contact/deal, and persist.
 * Best-effort: events with no artifact yet (or a fetch error) are skipped, not fatal,
 * and — because no row is written — are retried on the next run until the window passes.
 */
export async function syncMeetings({ sinceHours = 6 }: { sinceHours?: number } = {}): Promise<MeetSyncResult> {
  const supabase = supabaseService as unknown as SupabaseClient
  const now = Date.now()
  const since = new Date(now - sinceHours * 60 * 60 * 1000).toISOString()
  // Ended >10 min ago so the transcript/Gemini Doc has had time to settle.
  const until = new Date(now - 10 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('source', 'google')
    .not('meet_link', 'is', null)
    .gte('end_at', since)
    .lte('end_at', until)
    .order('end_at', { ascending: false })

  const candidates = (events ?? []) as CalendarEvent[]
  if (candidates.length === 0) return { scanned: 0, ingested: 0, skipped: 0, errors: 0 }

  // Drop events that already have a note (dedupe on calendar_event_id).
  const { data: existing } = await supabase
    .from('meeting_notes')
    .select('calendar_event_id')
    .in('calendar_event_id', candidates.map((e) => e.id))
  const have = new Set((existing ?? []).map((r) => r.calendar_event_id as string))
  const todo = candidates.filter((e) => !have.has(e.id))
  if (todo.length === 0) return { scanned: 0, ingested: 0, skipped: 0, errors: 0 }

  // Matching reference data + per-event token routing, loaded once.
  const [{ data: accounts }, { data: contacts }, { data: deals }, tokens, { data: syncs }] = await Promise.all([
    supabase.from('accounts').select('id, website, email_contact'),
    supabase.from('contacts').select('id, email, account_id'),
    supabase.from('deals').select('id, account_id, stage, updated_at'),
    getAllGoogleTokens(),
    supabase.from('gcal_sync').select('calendar_event_id, google_token_id').in('calendar_event_id', todo.map((e) => e.id)),
  ])
  const tokenByEvent = new Map<string, string>()
  for (const s of syncs ?? []) {
    if (s.google_token_id) tokenByEvent.set(s.calendar_event_id as string, s.google_token_id as string)
  }

  let ingested = 0
  let skipped = 0
  let errors = 0
  for (const event of todo) {
    try {
      const tokenRow = tokens.find((t) => t.id === tokenByEvent.get(event.id)) ?? tokens[0]
      if (!tokenRow) {
        skipped++
        continue
      }
      const meeting = await fetchMeetArtifacts(event, tokenRow)
      // No artifact yet (notes off / not ready / not organiser) → skip, retry next run.
      if (!meeting.transcript && !meeting.summary) {
        skipped++
        continue
      }
      const link = matchMeeting({
        attendeeEmails: meeting.attendees,
        accounts: accounts ?? [],
        contacts: contacts ?? [],
        deals: deals ?? [],
      })
      await upsertMeetingNote(meeting, link, supabase)
      ingested++
    } catch {
      errors++
    }
  }

  return { scanned: todo.length, ingested, skipped, errors }
}
