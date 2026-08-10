// Server-only thin client for the official Granola API (https://docs.granola.ai).
// All knowledge of the wire format lives here — nothing else should know it.
// Auth: Authorization: Bearer grn_...  (GRANOLA_API_KEY, server-only env var).

const GRANOLA_BASE_URL = 'https://public-api.granola.ai'

/** Thrown on HTTP 429 so callers can back off instead of retry-looping. */
export class GranolaRateLimitedError extends Error {
  constructor(message = 'Granola API rate limited (429)') {
    super(message)
    this.name = 'GranolaRateLimitedError'
  }
}

/** A list item from GET /v1/notes — no summary/attendees at this level. */
export interface GranolaNoteSummary {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

/** Our normalised shape, mapped from GET /v1/notes/{id}. */
export interface GranolaNote {
  granola_note_id: string
  title: string
  summary_md: string | null
  meeting_date: string | null
  attendees: Array<{ name: string | null; email: string }>
  source_updated_at: string | null
}

// --- Raw wire shapes (only what we consume) --------------------------------

interface RawNoteSummary {
  id: string
  title?: string | null
  created_at?: string
  updated_at?: string
}

interface RawListResponse {
  notes?: RawNoteSummary[]
  hasMore?: boolean
  cursor?: string | null
}

interface RawAttendee {
  name?: string | null
  email?: string
}

interface RawNote {
  id: string
  title?: string | null
  summary_markdown?: string | null
  attendees?: RawAttendee[] | null
  calendar_event?: {
    scheduled_start_time?: string | null
    // The calendar invite list is the canonical attendee source; note.attendees
    // alone is often just the note owner. invitees carry email only; organiser is
    // a bare email string.
    invitees?: Array<{ email?: string | null; name?: string | null }> | null
    organiser?: string | null
  } | null
  created_at?: string
  updated_at?: string
}

function getApiKey(): string {
  const key = process.env.GRANOLA_API_KEY
  if (!key) {
    throw new Error('GRANOLA_API_KEY is not configured')
  }
  return key
}

async function granolaFetch(path: string): Promise<Response> {
  const response = await fetch(`${GRANOLA_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
    },
    // Never cache — we want fresh notes each sync.
    cache: 'no-store',
  })

  if (response.status === 429) {
    throw new GranolaRateLimitedError()
  }

  return response
}

/**
 * List notes newest-first, paginated. `page_size` maxes at 30 per the API.
 * Returns the raw envelope (summary items only — fetch each note for detail).
 */
export async function listNotes(params: { cursor?: string; pageSize?: number } = {}): Promise<{
  notes: GranolaNoteSummary[]
  hasMore: boolean
  cursor: string | null
}> {
  const search = new URLSearchParams()
  search.set('page_size', String(params.pageSize ?? 30))
  if (params.cursor) {
    search.set('cursor', params.cursor)
  }

  const response = await granolaFetch(`/v1/notes?${search.toString()}`)
  if (!response.ok) {
    throw new Error(`Granola listNotes failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as RawListResponse
  const notes = (data.notes ?? []).map((n) => ({
    id: n.id,
    title: n.title ?? null,
    created_at: n.created_at ?? '',
    updated_at: n.updated_at ?? '',
  }))

  return {
    notes,
    hasMore: Boolean(data.hasMore),
    cursor: data.cursor ?? null,
  }
}

/**
 * Fetch a single note and map it to our shape. Returns null on 404 — the API
 * only serves notes with a generated summary, so a 404 means "not ready yet",
 * not an error. Throws on other non-2xx (and GranolaRateLimitedError on 429).
 */
export async function getNote(id: string): Promise<GranolaNote | null> {
  const response = await granolaFetch(`/v1/notes/${encodeURIComponent(id)}`)

  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Granola getNote failed: ${response.status} ${response.statusText}`)
  }

  const note = (await response.json()) as RawNote

  // Merge every attendee source, deduped by lowercased email, preferring an entry
  // that carries a real name. note.attendees is often just the owner; the calendar
  // event's invitees + organiser are what make it a full meeting.
  const byEmail = new Map<string, { name: string | null; email: string }>()
  const add = (email: string | null | undefined, name?: string | null) => {
    const trimmed = email?.trim()
    if (!trimmed) return
    const key = trimmed.toLowerCase()
    const cleanName = name?.trim() || null
    const existing = byEmail.get(key)
    if (!existing) byEmail.set(key, { name: cleanName, email: trimmed })
    else if (!existing.name && cleanName) existing.name = cleanName
  }
  for (const a of note.attendees ?? []) add(a.email, a.name)
  for (const inv of note.calendar_event?.invitees ?? []) add(inv.email, inv.name)
  add(note.calendar_event?.organiser)
  const attendees = Array.from(byEmail.values())

  return {
    granola_note_id: note.id,
    title: note.title ?? '',
    summary_md: note.summary_markdown ?? null,
    // Prefer the scheduled meeting time; fall back to when the note was created.
    meeting_date: note.calendar_event?.scheduled_start_time ?? note.created_at ?? null,
    attendees,
    source_updated_at: note.updated_at ?? null,
  }
}
