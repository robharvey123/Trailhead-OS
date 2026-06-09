import { google, type docs_v1 } from 'googleapis'
import { supabaseService } from '@/lib/supabase/service'
import type { CalendarEvent, GoogleTokens } from '@/lib/types'
import type { MeetingSummary, NormalisedMeeting } from '@/lib/meetings/types'
import { getAuthenticatedClientForToken } from './oauth'

// Google-specific fetcher. Resolves a Meet's transcript (Meet REST API v2) and the
// Gemini "take notes for me" summary Doc (Drive + Docs APIs), and returns the
// provider-neutral NormalisedMeeting. Every step is best-effort: a missing artifact,
// an inaccessible Doc (you weren't the organiser), or a 403 (scope not yet granted)
// degrades to null rather than throwing — so the polling cron never errors on a
// meeting that simply has no notes.

// --- Meet REST API v2 (googleapis has no first-class Meet client wired here) -------

interface MeetSpace { name?: string }
interface MeetConferenceRecord { name?: string; startTime?: string; endTime?: string }
interface MeetConferenceRecordList { conferenceRecords?: MeetConferenceRecord[] }
interface MeetTranscript { name?: string }
interface MeetTranscriptList { transcripts?: MeetTranscript[] }
interface MeetTranscriptEntry { text?: string }
interface MeetTranscriptEntryList { transcriptEntries?: MeetTranscriptEntry[]; nextPageToken?: string }

async function meetGet<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://meet.googleapis.com/v2/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null // 403 (scope) / 404 (no record) → treated as "no artifact"
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Pull the meeting code (abc-defg-hij) out of a Meet link. */
function meetingCodeFromLink(link: string | null): string | null {
  if (!link) return null
  const m = link.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i)
  return m ? m[1].toLowerCase() : null
}

async function fetchTranscript(
  token: string,
  meetingCode: string | null,
  occurredAtIso: string
): Promise<string | null> {
  if (!meetingCode) return null

  const space = await meetGet<MeetSpace>(token, `spaces/${meetingCode}`)
  if (!space?.name) return null

  const filter = encodeURIComponent(`space.name="${space.name}"`)
  const records = await meetGet<MeetConferenceRecordList>(token, `conferenceRecords?filter=${filter}`)
  const list = records?.conferenceRecords ?? []
  if (list.length === 0) return null

  // A space can host many conferences; pick the record closest to the event end.
  const target = Date.parse(occurredAtIso) || 0
  const record = [...list].sort((a, b) => {
    const ea = Date.parse(a.endTime ?? a.startTime ?? '') || 0
    const eb = Date.parse(b.endTime ?? b.startTime ?? '') || 0
    return Math.abs(ea - target) - Math.abs(eb - target)
  })[0]
  if (!record?.name) return null

  const transcripts = (await meetGet<MeetTranscriptList>(token, `${record.name}/transcripts`))?.transcripts ?? []
  if (transcripts.length === 0) return null

  const lines: string[] = []
  for (const t of transcripts) {
    if (!t.name) continue
    let pageToken: string | undefined
    do {
      const qs = pageToken ? `?pageSize=1000&pageToken=${encodeURIComponent(pageToken)}` : '?pageSize=1000'
      const page = await meetGet<MeetTranscriptEntryList>(token, `${t.name}/entries${qs}`)
      for (const e of page?.transcriptEntries ?? []) {
        if (e.text) lines.push(e.text)
      }
      pageToken = page?.nextPageToken
    } while (pageToken)
  }

  const text = lines.join('\n').trim()
  return text || null
}

// --- Gemini summary Doc (Drive search + Docs parse) --------------------------------

/** Route a heading to a summary bucket; null = not a recognised section heading. */
function routeHeading(text: string): keyof MeetingSummary | null {
  const t = text.toLowerCase()
  if (/decision/.test(t)) return 'decisions'
  if (/next step|action item|action|follow.?up|to.?do/.test(t)) return 'nextSteps'
  if (/summary|overview|tl;?dr/.test(t)) return 'summary'
  if (/detail|note|discussion|recap/.test(t)) return 'details'
  return null
}

function parseGeminiDoc(doc: docs_v1.Schema$Document): MeetingSummary {
  const paras: { text: string; isHeading: boolean }[] = []
  for (const el of doc.body?.content ?? []) {
    const p = el.paragraph
    if (!p) continue
    const text = (p.elements ?? [])
      .map((e) => e.textRun?.content ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    if (!text) continue
    const style = p.paragraphStyle?.namedStyleType ?? ''
    paras.push({ text, isHeading: /HEADING|TITLE|SUBTITLE/.test(style) })
  }

  const buckets: Record<'summary' | 'decisions' | 'nextSteps' | 'details', string[]> = {
    summary: [], decisions: [], nextSteps: [], details: [],
  }
  let current: keyof typeof buckets = 'summary'
  for (const para of paras) {
    if (para.isHeading) {
      current = routeHeading(para.text) ?? 'details'
      continue
    }
    buckets[current].push(para.text)
  }

  const summary = buckets.summary.join('\n').trim() || paras.find((p) => !p.isHeading)?.text || ''
  return {
    summary,
    decisions: buckets.decisions.filter(Boolean),
    nextSteps: buckets.nextSteps.filter(Boolean),
    details: buckets.details.join('\n').trim(),
  }
}

async function fetchSummary(
  auth: Awaited<ReturnType<typeof getAuthenticatedClientForToken>>,
  calEvent: CalendarEvent
): Promise<MeetingSummary | null> {
  try {
    const drive = google.drive({ version: 'v3', auth })
    // Gemini notes Docs are created shortly after the call, owned by the organiser,
    // and named like "<title> - Notes by Gemini". Window the search around the event.
    const createdMin = new Date(calEvent.start_at).toISOString()
    const createdMax = new Date(new Date(calEvent.end_at).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const q = [
      "mimeType='application/vnd.google-apps.document'",
      `createdTime > '${createdMin}'`,
      `createdTime < '${createdMax}'`,
      "(name contains 'Notes by Gemini' or name contains 'Notes' or name contains 'Meeting')",
      'trashed = false',
    ].join(' and ')

    const files = await drive.files.list({
      q,
      orderBy: 'createdTime desc',
      pageSize: 10,
      fields: 'files(id,name,createdTime)',
    })
    const candidates = files.data.files ?? []
    if (candidates.length === 0) return null

    // Prefer a Doc whose name shares a meaningful token with the meeting title.
    const titleTokens = (calEvent.title || '').toLowerCase().split(/\W+/).filter((t) => t.length > 3)
    const best =
      candidates.find((f) => titleTokens.some((t) => (f.name || '').toLowerCase().includes(t))) ??
      candidates[0]
    if (!best?.id) return null

    const docs = google.docs({ version: 'v1', auth })
    const doc = await docs.documents.get({ documentId: best.id })
    return parseGeminiDoc(doc.data)
  } catch {
    return null // Doc not in our Drive (not organiser) / scope not granted / parse error.
  }
}

// --- Calendar event id resolution --------------------------------------------------

async function resolveGcalEventId(calendarEventId: string): Promise<string | null> {
  const { data } = await supabaseService
    .from('gcal_sync')
    .select('gcal_event_id')
    .eq('calendar_event_id', calendarEventId)
    .maybeSingle()
  return (data?.gcal_event_id as string | undefined) ?? null
}

/**
 * Fetch a meeting's transcript + Gemini summary and return the source-neutral
 * NormalisedMeeting. Never throws on a missing artifact — returns nulls instead.
 */
export async function fetchMeetArtifacts(
  calEvent: CalendarEvent,
  tokenRow: GoogleTokens
): Promise<NormalisedMeeting> {
  const result: NormalisedMeeting = {
    source: 'google-meet',
    eventId: calEvent.id,
    occurredAt: calEvent.end_at,
    transcript: null,
    summary: null,
    attendees: [],
  }

  const auth = await getAuthenticatedClientForToken(tokenRow)

  // Attendees come from the Google Calendar event (calendar_events stores none).
  const gcalEventId = await resolveGcalEventId(calEvent.id)
  if (gcalEventId) {
    try {
      const calendar = google.calendar({ version: 'v3', auth })
      const ev = await calendar.events.get({ calendarId: 'primary', eventId: gcalEventId })
      result.attendees = (ev.data.attendees ?? [])
        .map((a) => a.email?.toLowerCase())
        .filter((e): e is string => Boolean(e))
    } catch {
      /* attendees stay empty */
    }
  }

  let token: string | null = null
  try {
    token = (await auth.getAccessToken()).token ?? null
  } catch {
    token = null
  }

  if (token) result.transcript = await fetchTranscript(token, meetingCodeFromLink(calEvent.meet_link), calEvent.end_at)
  result.summary = await fetchSummary(auth, calEvent)

  return result
}
