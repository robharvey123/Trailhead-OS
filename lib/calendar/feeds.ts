import type ical from 'node-ical'
import { supabaseService } from '@/lib/supabase/service'

export interface CalendarFeed {
  id: string
  name: string
  url: string
  colour: string
  enabled: boolean
  refresh_minutes: number
  last_fetched_at: string | null
  last_error: string | null
  event_count: number
  created_at: string
  updated_at: string
}

interface ParsedEvent {
  uid: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  location: string | null
}

function isVEvent(
  component: ical.CalendarComponent
): component is ical.VEvent {
  return component.type === 'VEVENT'
}

function toIsoString(
  value: ical.DateWithTimeZone | Date | string | undefined
): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

function isAllDay(event: ical.VEvent): boolean {
  const start = event.start
  if (!start) return false

  // node-ical sets dateOnly when the value is DATE (not DATE-TIME)
  if ('dateOnly' in start && (start as unknown as Record<string, unknown>).dateOnly) {
    return true
  }

  // Heuristic: if start has no time component (midnight UTC) and duration is in whole days
  if (start instanceof Date) {
    const h = start.getUTCHours()
    const m = start.getUTCMinutes()
    const s = start.getUTCSeconds()
    if (h === 0 && m === 0 && s === 0 && event.end instanceof Date) {
      const eh = event.end.getUTCHours()
      const em = event.end.getUTCMinutes()
      const es = event.end.getUTCSeconds()
      if (eh === 0 && em === 0 && es === 0) return true
    }
  }

  return false
}

export async function parseIcalFeed(icsText: string): Promise<ParsedEvent[]> {
  const nodeIcal = await import('node-ical')
  const parsed = nodeIcal.sync.parseICS(icsText)
  const events: ParsedEvent[] = []

  for (const key of Object.keys(parsed)) {
    const component = parsed[key]
    if (!component || !isVEvent(component)) continue

    const uid = component.uid
    const summary = component.summary
    if (!uid || !summary) continue

    const title = typeof summary === 'string' ? summary : summary.val
    const description = component.description
      ? typeof component.description === 'string'
        ? component.description
        : component.description.val
      : null
    const location = component.location
      ? typeof component.location === 'string'
        ? component.location
        : component.location.val
      : null

    const startAt = toIsoString(component.start)
    const endAt = toIsoString(component.end) ?? startAt
    if (!startAt || !endAt) continue

    events.push({
      uid,
      title,
      description,
      start_at: startAt,
      end_at: endAt,
      all_day: isAllDay(component),
      location,
    })
  }

  return events
}

export async function fetchAndSyncFeed(feed: CalendarFeed): Promise<{
  upserted: number
  removed: number
  error: string | null
}> {
  try {
    const response = await fetch(feed.url, {
      headers: { Accept: 'text/calendar' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`
      await supabaseService
        .from('calendar_feeds')
        .update({
          last_error: errorMsg,
          last_fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', feed.id)
      return { upserted: 0, removed: 0, error: errorMsg }
    }

    const icsText = await response.text()
    const parsedEvents = await parseIcalFeed(icsText)

    // Get all existing events for this feed
    const { data: existingEvents } = await supabaseService
      .from('calendar_events')
      .select('id, external_uid')
      .eq('feed_id', feed.id)

    const existingByUid = new Map(
      (existingEvents ?? []).map((e: { id: string; external_uid: string }) => [
        e.external_uid,
        e.id,
      ])
    )

    const incomingUids = new Set(parsedEvents.map((e) => e.uid))
    let upserted = 0

    // Upsert incoming events
    for (const event of parsedEvents) {
      const existingId = existingByUid.get(event.uid)

      if (existingId) {
        // Update existing
        await supabaseService
          .from('calendar_events')
          .update({
            title: event.title,
            description: event.description,
            start_at: event.start_at,
            end_at: event.end_at,
            all_day: event.all_day,
            location: event.location,
            colour: feed.colour,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
      } else {
        // Insert new
        await supabaseService.from('calendar_events').insert({
          title: event.title,
          description: event.description,
          start_at: event.start_at,
          end_at: event.end_at,
          all_day: event.all_day,
          location: event.location,
          colour: feed.colour,
          source: 'feed',
          feed_id: feed.id,
          external_uid: event.uid,
          read_only: true,
        })
      }

      upserted++
    }

    // Remove events that are no longer in the feed
    const toRemove = (existingEvents ?? [])
      .filter(
        (e: { id: string; external_uid: string }) =>
          !incomingUids.has(e.external_uid)
      )
      .map((e: { id: string }) => e.id)

    if (toRemove.length > 0) {
      await supabaseService
        .from('calendar_events')
        .delete()
        .in('id', toRemove)
    }

    // Update feed metadata
    await supabaseService
      .from('calendar_feeds')
      .update({
        last_fetched_at: new Date().toISOString(),
        last_error: null,
        event_count: parsedEvents.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', feed.id)

    return { upserted, removed: toRemove.length, error: null }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unknown error fetching feed'
    await supabaseService
      .from('calendar_feeds')
      .update({
        last_error: errorMsg,
        last_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', feed.id)
    return { upserted: 0, removed: 0, error: errorMsg }
  }
}

export async function syncAllFeeds(): Promise<{
  results: Array<{ feed_id: string; name: string; upserted: number; removed: number; error: string | null }>
}> {
  const { data: feeds } = await supabaseService
    .from('calendar_feeds')
    .select('*')
    .eq('enabled', true)
    .order('created_at')

  if (!feeds || feeds.length === 0) {
    return { results: [] }
  }

  const results: Array<{
    feed_id: string
    name: string
    upserted: number
    removed: number
    error: string | null
  }> = []

  for (const feed of feeds as CalendarFeed[]) {
    const result = await fetchAndSyncFeed(feed)
    results.push({
      feed_id: feed.id,
      name: feed.name,
      ...result,
    })
  }

  return { results }
}
