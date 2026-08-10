import { supabaseService } from '@/lib/supabase/service'
import { getNote, listNotes, GranolaRateLimitedError, type GranolaNote } from '@/lib/granola'

// Newest-first paging bounds and pacing. The Granola API allows 5 req/s
// sustained; ~300ms between the per-note fetches keeps us comfortably under.
const MAX_PAGES = 5
const REQUEST_SPACING_MS = 300

export interface GranolaSyncResult {
  pages: number
  synced: number
  linked: number
  rateLimited: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ContactRef = { id: string; account_id: string | null }

/**
 * Build a lowercased-email → contacts index once per run. The CRM is small, so
 * one pass is cheaper than a query per attendee and sidesteps ILIKE escaping.
 */
async function buildContactIndex(): Promise<Map<string, ContactRef[]>> {
  const index = new Map<string, ContactRef[]>()
  const { data, error } = await supabaseService
    .from('contacts')
    .select('id, email, account_id')
    .not('email', 'is', null)
  if (error) throw new Error(error.message || 'Failed to load contacts for meeting linking')

  for (const row of (data ?? []) as Array<{ id: string; email: string | null; account_id: string | null }>) {
    const email = row.email?.trim().toLowerCase()
    if (!email) continue
    const list = index.get(email) ?? []
    list.push({ id: row.id, account_id: row.account_id })
    index.set(email, list)
  }
  return index
}

/** Upsert one note. Omits account_id so linking owns it and updates don't clobber it. */
async function upsertMeeting(note: GranolaNote): Promise<{ id: string; account_id: string | null }> {
  const { data, error } = await supabaseService
    .from('meetings')
    .upsert(
      {
        granola_note_id: note.granola_note_id,
        title: note.title,
        summary_md: note.summary_md,
        meeting_date: note.meeting_date,
        attendees: note.attendees,
        source_updated_at: note.source_updated_at,
      },
      { onConflict: 'granola_note_id' }
    )
    .select('id, account_id')
    .single()
  if (error) throw new Error(error.message || 'Failed to upsert meeting')
  return data as { id: string; account_id: string | null }
}

/**
 * Link a meeting to any contacts whose email matches an attendee (case-insensitive),
 * and set the meeting's account from the first matched contact if it has none yet.
 * Returns the number of contact links made.
 */
async function linkMeeting(
  meetingId: string,
  currentAccountId: string | null,
  attendees: GranolaNote['attendees'],
  contactIndex: Map<string, ContactRef[]>
): Promise<number> {
  const emails = Array.from(
    new Set(attendees.map((a) => a.email.trim().toLowerCase()).filter(Boolean))
  )
  const matched: ContactRef[] = []
  for (const email of emails) {
    for (const contact of contactIndex.get(email) ?? []) {
      matched.push(contact)
    }
  }
  if (matched.length === 0) return 0

  const contactIds = Array.from(new Set(matched.map((c) => c.id)))
  const { error: linkError } = await supabaseService
    .from('meeting_contacts')
    .upsert(
      contactIds.map((contact_id) => ({ meeting_id: meetingId, contact_id })),
      { onConflict: 'meeting_id,contact_id', ignoreDuplicates: true }
    )
  if (linkError) throw new Error(linkError.message || 'Failed to link meeting contacts')

  // Link every distinct account the matched contacts belong to (a meeting can span
  // several). Manual edits on top of these live in meeting_accounts too.
  const accountIds = Array.from(new Set(matched.map((c) => c.account_id).filter((a): a is string => !!a)))
  if (accountIds.length > 0) {
    const { error: maError } = await supabaseService
      .from('meeting_accounts')
      .upsert(
        accountIds.map((account_id) => ({ meeting_id: meetingId, account_id })),
        { onConflict: 'meeting_id,account_id', ignoreDuplicates: true }
      )
    if (maError) throw new Error(maError.message || 'Failed to link meeting accounts')
  }

  // Keep the legacy primary account populated for backward compatibility.
  if (!currentAccountId && accountIds.length > 0) {
    const { error: acctError } = await supabaseService
      .from('meetings')
      .update({ account_id: accountIds[0] })
      .eq('id', meetingId)
    if (acctError) throw new Error(acctError.message || 'Failed to set meeting account')
  }

  return contactIds.length
}

/**
 * Sync Granola notes into `meetings`, newest-first. Pages until a page is
 * entirely known-and-unchanged, or MAX_PAGES, whichever comes first. Shared by
 * the cron and the "Sync now" action. Runs with the service role.
 */
export async function syncGranolaMeetings(): Promise<GranolaSyncResult> {
  const contactIndex = await buildContactIndex()

  let cursor: string | undefined
  let pages = 0
  let synced = 0
  let linked = 0
  let rateLimited = false

  try {
    while (pages < MAX_PAGES) {
      const page = await listNotes({ cursor })
      pages++
      if (page.notes.length === 0) break

      const ids = page.notes.map((n) => n.id)
      const { data: existing } = await supabaseService
        .from('meetings')
        .select('granola_note_id, source_updated_at')
        .in('granola_note_id', ids)
      const knownUpdatedAt = new Map<string, string | null>(
        (existing ?? []).map((r) => [
          r.granola_note_id as string,
          (r.source_updated_at as string | null) ?? null,
        ])
      )

      let changedOnPage = 0
      for (const summary of page.notes) {
        const isKnown = knownUpdatedAt.has(summary.id)
        const prev = knownUpdatedAt.get(summary.id)
        // Skip notes we already have with an unchanged Granola updated_at.
        if (isKnown && prev && summary.updated_at && prev === summary.updated_at) {
          continue
        }
        changedOnPage++

        await sleep(REQUEST_SPACING_MS)
        const note = await getNote(summary.id)
        // null → note has no summary yet ("not ready"), skip without erroring.
        if (!note) continue

        const meeting = await upsertMeeting(note)
        synced++
        linked += await linkMeeting(meeting.id, meeting.account_id, note.attendees, contactIndex)
      }

      // Whole page already known & unchanged → nothing newer beyond it.
      if (changedOnPage === 0) break
      if (!page.hasMore || !page.cursor) break
      cursor = page.cursor
    }
  } catch (err) {
    // Back off on 429 rather than retry-looping; report partial progress.
    if (err instanceof GranolaRateLimitedError) {
      rateLimited = true
    } else {
      throw err
    }
  }

  return { pages, synced, linked, rateLimited }
}
