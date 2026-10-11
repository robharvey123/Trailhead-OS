import {
  CALENDAR_EVENT_SELECT,
  CoworkApiError,
  formatCalendarEvent,
  getCalendarEventById,
  getWorkstreamBySlug,
  noRecognisedFieldsError,
  optionalIsoDatetime,
  optionalLinkedId,
  optionalString,
  requiredString,
} from '@/lib/cowork-api'
import { recordCoworkWrite } from '@/lib/cowork-audit'
import { deleteGcalEvent, pushEventToGoogle } from '@/lib/google/calendar'
import { supabaseService } from '@/lib/supabase/service'

/**
 * Shared calendar write logic for the Cowork REST API and the MCP server — same
 * contract as lib/cowork-projects.ts.
 *
 * Events pulled in from a feed, or from a non-primary Google/Microsoft calendar,
 * are stamped `read_only` by their sync (lib/calendar/feeds.ts,
 * lib/google/calendar.ts, lib/microsoft/calendar.ts) and the UI will not edit
 * them. Here they are a 409: an edit would be overwritten on the next sync.
 */

/** The accepted-field list quoted back on a no-recognised-fields 400. */
export const CALENDAR_EVENT_PATCH_FIELDS = [
  'title',
  'start_at',
  'end_at',
  'all_day',
  'location',
  'description',
  'colour',
  'workstream',
  'contact_id',
  'project_id',
  'engagement_id',
]

type ExistingEvent = Awaited<ReturnType<typeof getCalendarEventById>>

function assertEditable(event: ExistingEvent, verb: string) {
  if (event.read_only === true || event.source === 'feed') {
    throw new CoworkApiError(
      `"${event.title}" is a read-only ${event.source ?? 'synced'} event and cannot be ${verb} here; change it in its source calendar.`,
      409
    )
  }
}

/** contact_id / project_id / engagement_id: uuid or null, and the row must exist. */
async function parseLinks(body: Record<string, unknown>) {
  const links: Record<string, string | null> = {}
  if (body.contact_id !== undefined) links.contact_id = await optionalLinkedId(body.contact_id, 'contact_id', 'contacts')
  if (body.project_id !== undefined) links.project_id = await optionalLinkedId(body.project_id, 'project_id', 'projects')
  if (body.engagement_id !== undefined) {
    links.engagement_id = await optionalLinkedId(body.engagement_id, 'engagement_id', 'engagements')
  }
  return links
}

function assertOrdered(startAt: string, endAt: string) {
  if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
    throw new CoworkApiError('end_at must be on or after start_at', 400)
  }
}

function whenLabel(startAt: string) {
  return startAt.slice(0, 16).replace('T', ' ')
}

/** POST /api/cowork/calendar. Pushes to Google when a Google account is connected. */
export async function createCoworkCalendarEvent(body: Record<string, unknown>) {
  const title = requiredString(body.title, 'title')
  const startAt = optionalIsoDatetime(body.start_at, 'start_at')
  const endAt = optionalIsoDatetime(body.end_at, 'end_at')
  if (!startAt || !endAt) throw new CoworkApiError('start_at and end_at are required', 400)
  assertOrdered(startAt, endAt)

  const workstreamSlug = optionalString(body.workstream)
  const workstream = workstreamSlug ? await getWorkstreamBySlug(workstreamSlug) : null
  const links = await parseLinks(body)

  const { data, error } = await supabaseService
    .from('calendar_events')
    .insert({
      title,
      start_at: startAt,
      end_at: endAt,
      all_day: body.all_day === true,
      location: optionalString(body.location),
      description: optionalString(body.description),
      workstream_id: workstream?.id ?? null,
      colour: optionalString(body.colour),
      ...links,
    })
    .select(CALENDAR_EVENT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to create calendar event', 500)

  void (async () => {
    const { data: tokenRow } = await supabaseService
      .from('google_tokens')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (!tokenRow) return
    await pushEventToGoogle(data as never)
  })().catch(() => {})

  const event = formatCalendarEvent(data as never)
  void recordCoworkWrite({
    action: 'create',
    entity: 'calendar_event',
    entityId: event.id,
    entityLabel: event.title,
    engagementId: event.engagement_id,
    summary: `Added calendar event "${event.title}" on ${whenLabel(event.start_at)}`,
    payload: body,
  })
  return event
}

/**
 * PATCH /api/cowork/calendar/[id] and the MCP `update_calendar_event` tool.
 * Re-pushes to Google when the event is already synced there.
 */
export async function updateCoworkCalendarEvent(id: string, body: Record<string, unknown>) {
  const existing = await getCalendarEventById(id)
  assertEditable(existing, 'edited')
  const patch: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = optionalString(body.title)
    if (!title) throw new CoworkApiError('title must be a non-empty string', 400)
    patch.title = title
  }
  if (body.start_at !== undefined) {
    const startAt = optionalIsoDatetime(body.start_at, 'start_at')
    if (!startAt) throw new CoworkApiError('start_at cannot be cleared', 400)
    patch.start_at = startAt
  }
  if (body.end_at !== undefined) {
    const endAt = optionalIsoDatetime(body.end_at, 'end_at')
    if (!endAt) throw new CoworkApiError('end_at cannot be cleared', 400)
    patch.end_at = endAt
  }
  if (body.all_day !== undefined) {
    if (typeof body.all_day !== 'boolean') throw new CoworkApiError('all_day must be a boolean', 400)
    patch.all_day = body.all_day
  }
  if (body.location !== undefined) patch.location = optionalString(body.location)
  if (body.description !== undefined) patch.description = optionalString(body.description)
  if (body.colour !== undefined) patch.colour = optionalString(body.colour)
  if (body.workstream !== undefined) {
    const slug = optionalString(body.workstream)
    patch.workstream_id = slug ? (await getWorkstreamBySlug(slug)).id : null
  }
  Object.assign(patch, await parseLinks(body))

  if (Object.keys(patch).length === 0) {
    if (Object.keys(body).length > 0) throw noRecognisedFieldsError(body, CALENDAR_EVENT_PATCH_FIELDS)
    throw new CoworkApiError('No changes supplied', 400)
  }

  assertOrdered(String(patch.start_at ?? existing.start_at), String(patch.end_at ?? existing.end_at))

  const { data, error } = await supabaseService
    .from('calendar_events')
    .update(patch)
    .eq('id', id)
    .select(CALENDAR_EVENT_SELECT)
    .single()
  if (error) throw new CoworkApiError(error.message || 'Failed to update calendar event', 500)

  if ((data as { gcal_sync?: unknown }).gcal_sync) {
    void pushEventToGoogle(data as never).catch(() => {})
  }

  const event = formatCalendarEvent(data as never)
  void recordCoworkWrite({
    action: 'update',
    entity: 'calendar_event',
    entityId: event.id,
    entityLabel: event.title,
    engagementId: event.engagement_id,
    summary: `Updated calendar event "${event.title}" on ${whenLabel(event.start_at)} (${Object.keys(patch).join(', ')})`,
    payload: body,
  })
  return event
}

/** DELETE /api/cowork/calendar/[id]. Permanent; also removes the Google copy. */
export async function deleteCoworkCalendarEvent(id: string) {
  const existing = await getCalendarEventById(id)
  assertEditable(existing, 'deleted')

  void deleteGcalEvent(id).catch(() => {})

  const { error } = await supabaseService.from('calendar_events').delete().eq('id', id)
  if (error) throw new CoworkApiError(error.message || 'Failed to delete calendar event', 500)

  const event = formatCalendarEvent(existing)
  void recordCoworkWrite({
    action: 'delete',
    entity: 'calendar_event',
    entityId: id,
    entityLabel: event.title,
    engagementId: event.engagement_id,
    summary: `Deleted calendar event "${event.title}" on ${whenLabel(event.start_at)}`,
    payload: event,
  })
  return { deleted: true }
}
