import { google } from 'googleapis'
import { supabaseService } from '@/lib/supabase/service'
import type { CalendarEvent, GcalSync } from '@/lib/types'
import { getAuthenticatedClient } from './oauth'

export async function getCalendarClient() {
  const auth = await getAuthenticatedClient()
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
