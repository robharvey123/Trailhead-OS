import { google, type calendar_v3 } from 'googleapis'
import { supabaseService } from '@/lib/supabase/service'
import type { CalendarEvent, GcalSync, GoogleTokens } from '@/lib/types'
import { getAuthenticatedClient, getAuthenticatedClientForToken, getAllGoogleTokens } from './oauth'

export async function getCalendarClient(tokenId?: string) {
  const auth = await getAuthenticatedClient(tokenId)
  return google.calendar({ version: 'v3', auth })
}

export async function getCalendarClientForToken(tokenRow: GoogleTokens) {
  const auth = await getAuthenticatedClientForToken(tokenRow)
  return google.calendar({ version: 'v3', auth })
}

function toAllDayDate(value: string) {
  return value.split('T')[0]
}

function toGoogleEventPayload(event: CalendarEvent) {
  return {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
    start: event.all_day
      ? { date: toAllDayDate(event.start_at) }
      : { dateTime: event.start_at, timeZone: 'Europe/London' },
    end: event.all_day
      ? { date: toAllDayDate(event.end_at) }
      : { dateTime: event.end_at, timeZone: 'Europe/London' },
  }
}

function toLocalDateTime(
  value: { dateTime?: string | null; date?: string | null } | null | undefined
) {
  if (value?.dateTime) {
    return value.dateTime
  }

  if (value?.date) {
    return `${value.date}T00:00:00Z`
  }

  return null
}

export async function pushEventToGoogle(event: CalendarEvent): Promise<string> {
  const calendar = await getCalendarClient()
  const gcalEvent = toGoogleEventPayload(event)

  const { data: existing } = await supabaseService
    .from('gcal_sync')
    .select('id, gcal_event_id')
    .eq('calendar_event_id', event.id)
    .maybeSingle<GcalSync>()

  if (existing?.gcal_event_id) {
    await calendar.events.update({
      calendarId: 'primary',
      eventId: existing.gcal_event_id,
      requestBody: gcalEvent,
    })

    await supabaseService
      .from('gcal_sync')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_direction: 'both',
      })
      .eq('id', existing.id)

    return existing.gcal_event_id
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: gcalEvent,
  })

  const gcalEventId = response.data.id
  if (!gcalEventId) {
    throw new Error('Google Calendar did not return an event id')
  }

  await supabaseService.from('gcal_sync').insert({
    calendar_event_id: event.id,
    gcal_event_id: gcalEventId,
    sync_direction: 'both',
  })

  return gcalEventId
}

export async function pullEventsFromGoogle(timeMin: string, timeMax: string) {
  const calendar = await getCalendarClient()

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  })

  const events = response.data.items || []
  const created: CalendarEvent[] = []

  for (const gcalEvent of events) {
    if (!gcalEvent.id || !gcalEvent.summary) {
      continue
    }

    const start_at = toLocalDateTime(gcalEvent.start)
    const end_at = toLocalDateTime(gcalEvent.end)

    if (!start_at || !end_at) {
      continue
    }

    const { data: existing } = await supabaseService
      .from('gcal_sync')
      .select('id, calendar_event_id')
      .eq('gcal_event_id', gcalEvent.id)
      .maybeSingle<Pick<GcalSync, 'id' | 'calendar_event_id'>>()

    if (existing?.calendar_event_id) {
      await supabaseService
        .from('calendar_events')
        .update({
          title: gcalEvent.summary,
          description: gcalEvent.description || null,
          location: gcalEvent.location || null,
          start_at,
          end_at,
          all_day: Boolean(gcalEvent.start?.date),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.calendar_event_id)

      await supabaseService
        .from('gcal_sync')
        .update({
          last_synced_at: new Date().toISOString(),
          sync_direction: 'both',
        })
        .eq('id', existing.id)

      continue
    }

    const { data: newEvent, error } = await supabaseService
      .from('calendar_events')
      .insert({
        title: gcalEvent.summary,
        description: gcalEvent.description || null,
        location: gcalEvent.location || null,
        start_at,
        end_at,
        all_day: Boolean(gcalEvent.start?.date),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single<CalendarEvent>()

    if (error || !newEvent) {
      throw new Error(error?.message || 'Failed to create local calendar event')
    }

    await supabaseService.from('gcal_sync').insert({
      calendar_event_id: newEvent.id,
      gcal_event_id: gcalEvent.id,
      sync_direction: 'both',
    })

    created.push(newEvent)
  }

  return { synced: events.length, created: created.length }
}

export async function deleteGcalEvent(calendarEventId: string) {
  const { data: syncRow } = await supabaseService
    .from('gcal_sync')
    .select('gcal_event_id')
    .eq('calendar_event_id', calendarEventId)
    .maybeSingle<Pick<GcalSync, 'gcal_event_id'>>()

  if (!syncRow?.gcal_event_id) {
    return
  }

  const calendar = await getCalendarClient()
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: syncRow.gcal_event_id,
  })

  await supabaseService.from('gcal_sync').delete().eq('calendar_event_id', calendarEventId)
}

// ========================================
// Multi-account & multi-calendar support
// ========================================

export interface GoogleCalendarInfo {
  id: string
  summary: string
  description: string | null
  backgroundColor: string | null
  primary: boolean
  accessRole: string
}

export async function listGoogleCalendars(tokenId: string): Promise<GoogleCalendarInfo[]> {
  const calendar = await getCalendarClient(tokenId)

  const response = await calendar.calendarList.list({
    minAccessRole: 'reader',
  })

  const items = response.data.items ?? []

  return items
    .filter((item): item is calendar_v3.Schema$CalendarListEntry & { id: string } =>
      Boolean(item.id && item.summary)
    )
    .map((item) => ({
      id: item.id,
      summary: item.summary ?? item.id,
      description: item.description ?? null,
      backgroundColor: item.backgroundColor ?? null,
      primary: item.primary ?? false,
      accessRole: item.accessRole ?? 'reader',
    }))
}

export interface GoogleCalendarSelection {
  id: string
  google_token_id: string
  gcal_calendar_id: string
  name: string
  colour: string | null
  enabled: boolean
  sync_direction: 'push' | 'pull' | 'both'
  created_at: string
  updated_at: string
}

export async function getCalendarSelections(
  tokenId: string
): Promise<GoogleCalendarSelection[]> {
  const { data, error } = await supabaseService
    .from('google_calendar_selections')
    .select('*')
    .eq('google_token_id', tokenId)
    .order('created_at')

  if (error) throw new Error(error.message)
  return (data ?? []) as GoogleCalendarSelection[]
}

export async function upsertCalendarSelection(
  tokenId: string,
  calendarId: string,
  name: string,
  enabled: boolean,
  colour?: string | null,
  syncDirection?: 'push' | 'pull' | 'both'
) {
  const { data, error } = await supabaseService
    .from('google_calendar_selections')
    .upsert(
      {
        google_token_id: tokenId,
        gcal_calendar_id: calendarId,
        name,
        enabled,
        colour: colour ?? null,
        sync_direction: syncDirection ?? 'pull',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'google_token_id,gcal_calendar_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as GoogleCalendarSelection
}

export async function pullEventsFromGoogleCalendar(
  tokenRow: GoogleTokens,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<{ synced: number; created: number }> {
  const calendar = await getCalendarClientForToken(tokenRow)

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 500,
  })

  const events = response.data.items ?? []
  if (events.length === 0) return { synced: 0, created: 0 }

  const isPrimary = calendarId === 'primary' || calendarId === tokenRow.email

  // Batch-load all existing gcal_sync rows for this calendar
  const gcalEventIds = events.map((e) => e.id).filter(Boolean) as string[]
  const { data: existingSyncRows } = await supabaseService
    .from('gcal_sync')
    .select('id, calendar_event_id, gcal_event_id')
    .in('gcal_event_id', gcalEventIds)

  const syncByGcalId = new Map(
    (existingSyncRows ?? []).map((row: Pick<GcalSync, 'id' | 'calendar_event_id'> & { gcal_event_id: string }) => [
      row.gcal_event_id,
      row,
    ])
  )

  // Batch-check which linked calendar_events still exist
  const linkedEventIds = (existingSyncRows ?? [])
    .map((row: { calendar_event_id: string }) => row.calendar_event_id)
    .filter(Boolean)

  const existingEventIds = new Set<string>()
  if (linkedEventIds.length > 0) {
    const { data: existingEvents } = await supabaseService
      .from('calendar_events')
      .select('id')
      .in('id', linkedEventIds)
    for (const row of existingEvents ?? []) {
      existingEventIds.add((row as { id: string }).id)
    }
  }

  // Clean up orphaned sync rows in one go
  const orphanedSyncIds = (existingSyncRows ?? [])
    .filter((row: { calendar_event_id: string }) => !existingEventIds.has(row.calendar_event_id))
    .map((row: { id: string }) => row.id)

  if (orphanedSyncIds.length > 0) {
    await supabaseService.from('gcal_sync').delete().in('id', orphanedSyncIds)
  }

  let synced = 0
  let created = 0

  for (const gcalEvent of events) {
    if (!gcalEvent.id || !gcalEvent.summary) continue

    const start_at = toLocalDateTime(gcalEvent.start)
    const end_at = toLocalDateTime(gcalEvent.end)
    if (!start_at || !end_at) continue

    const existing = syncByGcalId.get(gcalEvent.id)

    if (existing && existingEventIds.has(existing.calendar_event_id)) {
      // Event exists — update it
      await supabaseService
        .from('calendar_events')
        .update({
          title: gcalEvent.summary,
          description: gcalEvent.description || null,
          location: gcalEvent.location || null,
          start_at,
          end_at,
          all_day: Boolean(gcalEvent.start?.date),
          source: 'google',
          external_uid: gcalEvent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.calendar_event_id)

      synced++
      continue
    }

    // Insert new calendar event
    const { data: newEvent, error } = await supabaseService
      .from('calendar_events')
      .insert({
        title: gcalEvent.summary,
        description: gcalEvent.description || null,
        location: gcalEvent.location || null,
        start_at,
        end_at,
        all_day: Boolean(gcalEvent.start?.date),
        source: 'google',
        external_uid: gcalEvent.id,
        read_only: !isPrimary,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !newEvent) continue

    await supabaseService.from('gcal_sync').insert({
      calendar_event_id: newEvent.id,
      gcal_event_id: gcalEvent.id,
      gcal_calendar_id: calendarId,
      google_token_id: tokenRow.id,
      sync_direction: isPrimary ? 'both' : 'pull',
    })

    created++
    synced++
  }

  return { synced, created }
}

export async function syncAllGoogleAccounts(
  days: number = 30
): Promise<{
  accounts: Array<{
    email: string
    calendars: Array<{ name: string; synced: number; created: number; error?: string }>
    error?: string
  }>
  totalPushed: number
  totalPulled: number
}> {
  const tokens = await getAllGoogleTokens()
  // Sync from the 1st of the current month forwards
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const timeMin = monthStart.toISOString()
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const accounts: Array<{
    email: string
    calendars: Array<{ name: string; synced: number; created: number }>
  }> = []
  let totalPushed = 0
  let totalPulled = 0

  for (const tokenRow of tokens) {
    const selections = await getCalendarSelections(tokenRow.id)
    const enabledSelections = selections.filter((s) => s.enabled)

    const calendarResults: Array<{ name: string; synced: number; created: number; error?: string }> = []

    // If no selections configured, sync primary by default
    const calendarsToSync =
      enabledSelections.length > 0
        ? enabledSelections.map((s) => ({
            id: s.gcal_calendar_id,
            name: s.name,
            direction: s.sync_direction,
          }))
        : [{ id: 'primary', name: 'Primary', direction: 'both' as const }]

    for (const cal of calendarsToSync) {
      try {
        // Pull events
        if (cal.direction === 'pull' || cal.direction === 'both') {
          const result = await pullEventsFromGoogleCalendar(
            tokenRow,
            cal.id,
            timeMin,
            timeMax
          )
          totalPulled += result.synced
          calendarResults.push({
            name: cal.name,
            synced: result.synced,
            created: result.created,
          })
        }

        // Push events (only for calendars with push/both direction)
        if (cal.direction === 'push' || cal.direction === 'both') {
          const { data: localEvents } = await supabaseService
            .from('calendar_events')
            .select('*')
            .eq('source', 'manual')

          const { data: syncRows } = await supabaseService
            .from('gcal_sync')
            .select('calendar_event_id')

          const syncedIds = new Set(
            (syncRows ?? []).map((row: { calendar_event_id: string }) => row.calendar_event_id)
          )
          const unsyncedEvents = ((localEvents ?? []) as CalendarEvent[]).filter(
            (event) => !syncedIds.has(event.id)
          )

          for (const event of unsyncedEvents) {
            await pushEventToGoogle(event)
            totalPushed++
          }
        }
      } catch (calError) {
        calendarResults.push({
          name: cal.name,
          synced: 0,
          created: 0,
          error: calError instanceof Error ? calError.message : 'Unknown error',
        })
      }
    }

    accounts.push({
      email: tokenRow.email ?? 'Unknown',
      calendars: calendarResults,
    })
  }

  return { accounts, totalPushed, totalPulled }
}
