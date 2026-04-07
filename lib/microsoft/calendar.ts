import { supabaseService } from '@/lib/supabase/service'
import type { CalendarEvent, MicrosoftTokens, MsCalSync } from '@/lib/types'
import { getAuthenticatedToken, getAllMicrosoftTokens, refreshAccessToken } from './oauth'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ========================================
// Graph API helpers
// ========================================

async function graphFetch(tokenRow: MicrosoftTokens, path: string, init?: RequestInit): Promise<Response> {
  let token = tokenRow
  // Refresh if expired
  if (token.expiry_date && token.expiry_date < Date.now() + 60_000) {
    token = await refreshAccessToken(token)
  }

  const response = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  return response
}

// ========================================
// Calendar listing
// ========================================

export interface MicrosoftCalendarInfo {
  id: string
  name: string
  colour: string | null
  isDefaultCalendar: boolean
  canEdit: boolean
}

export async function listMicrosoftCalendars(tokenId: string): Promise<MicrosoftCalendarInfo[]> {
  const token = await getAuthenticatedToken(tokenId)
  const response = await graphFetch(token, '/me/calendars')

  if (!response.ok) {
    throw new Error(`Failed to list calendars: ${response.status}`)
  }

  const data = await response.json()
  const calendars = (data.value ?? []) as Array<{
    id: string
    name: string
    color: string
    isDefaultCalendar: boolean
    canEdit: boolean
  }>

  return calendars.map((cal) => ({
    id: cal.id,
    name: cal.name,
    colour: graphColourToHex(cal.color),
    isDefaultCalendar: cal.isDefaultCalendar,
    canEdit: cal.canEdit,
  }))
}

// Microsoft Graph uses colour names, map to hex
function graphColourToHex(colour: string): string {
  const map: Record<string, string> = {
    auto: '#3B82F6',
    lightBlue: '#60A5FA',
    lightGreen: '#4ADE80',
    lightOrange: '#FB923C',
    lightGray: '#94A3B8',
    lightYellow: '#FDE047',
    lightTeal: '#2DD4BF',
    lightPink: '#F472B6',
    lightBrown: '#A3866A',
    lightRed: '#F87171',
    maxColor: '#3B82F6',
  }
  return map[colour] ?? '#3B82F6'
}

// ========================================
// Calendar selections CRUD
// ========================================

export interface MicrosoftCalendarSelection {
  id: string
  microsoft_token_id: string
  ms_calendar_id: string
  name: string
  colour: string | null
  enabled: boolean
  sync_direction: 'push' | 'pull' | 'both'
  created_at: string
  updated_at: string
}

export async function getCalendarSelections(tokenId: string): Promise<MicrosoftCalendarSelection[]> {
  const { data, error } = await supabaseService
    .from('microsoft_calendar_selections')
    .select('*')
    .eq('microsoft_token_id', tokenId)
    .order('created_at')

  if (error) throw new Error(error.message)
  return (data ?? []) as MicrosoftCalendarSelection[]
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
    .from('microsoft_calendar_selections')
    .upsert(
      {
        microsoft_token_id: tokenId,
        ms_calendar_id: calendarId,
        name,
        enabled,
        colour: colour ?? null,
        sync_direction: syncDirection ?? 'pull',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'microsoft_token_id,ms_calendar_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as MicrosoftCalendarSelection
}

// ========================================
// Event type conversion
// ========================================

function toLocalDateTime(msDateTime: { dateTime: string; timeZone: string } | undefined): string | null {
  if (!msDateTime?.dateTime) return null
  // Graph returns dateTime without Z but in the specified timezone
  // Append Z if not present since we store as UTC
  const dt = msDateTime.dateTime
  return dt.endsWith('Z') ? dt : `${dt}Z`
}

function toGraphDateTime(isoString: string, allDay: boolean) {
  if (allDay) {
    return {
      dateTime: isoString.split('T')[0] + 'T00:00:00.0000000',
      timeZone: 'UTC',
    }
  }
  return {
    dateTime: isoString.replace('Z', '.0000000'),
    timeZone: 'UTC',
  }
}

// ========================================
// Push event to Microsoft
// ========================================

export async function pushEventToMicrosoft(event: CalendarEvent, tokenId?: string): Promise<string> {
  const token = await getAuthenticatedToken(tokenId)

  const graphEvent = {
    subject: event.title,
    body: { contentType: 'text', content: event.description ?? '' },
    start: toGraphDateTime(event.start_at, event.all_day),
    end: toGraphDateTime(event.end_at, event.all_day),
    isAllDay: event.all_day,
    location: event.location ? { displayName: event.location } : undefined,
  }

  const { data: existing } = await supabaseService
    .from('ms_cal_sync')
    .select('id, ms_event_id')
    .eq('calendar_event_id', event.id)
    .maybeSingle<Pick<MsCalSync, 'id' | 'ms_event_id'>>()

  if (existing?.ms_event_id) {
    // Update existing
    await graphFetch(token, `/me/events/${existing.ms_event_id}`, {
      method: 'PATCH',
      body: JSON.stringify(graphEvent),
    })

    await supabaseService
      .from('ms_cal_sync')
      .update({ last_synced_at: new Date().toISOString(), sync_direction: 'both' })
      .eq('id', existing.id)

    return existing.ms_event_id
  }

  // Create new
  const response = await graphFetch(token, '/me/events', {
    method: 'POST',
    body: JSON.stringify(graphEvent),
  })

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.status}`)
  }

  const created = await response.json()
  const msEventId = created.id as string

  await supabaseService.from('ms_cal_sync').insert({
    calendar_event_id: event.id,
    ms_event_id: msEventId,
    sync_direction: 'both',
    microsoft_token_id: token.id,
  })

  return msEventId
}

// ========================================
// Pull events from Microsoft
// ========================================

export async function pullEventsFromMicrosoftCalendar(
  tokenRow: MicrosoftTokens,
  calendarId: string,
  timeMin: string,
  timeMax: string,
  userId?: string
): Promise<{ synced: number; created: number; errors: string[] }> {
  const startDate = new Date(timeMin).toISOString()
  const endDate = new Date(timeMax).toISOString()

  const params = new URLSearchParams({
    startDateTime: startDate,
    endDateTime: endDate,
    $top: '500',
    $orderby: 'start/dateTime',
    $select: 'id,subject,body,start,end,isAllDay,location,sensitivity',
  })

  const response = await graphFetch(
    tokenRow,
    `/me/calendars/${calendarId}/calendarView?${params}`
  )

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    return { synced: 0, created: 0, errors: [`Graph API ${response.status}: ${errText.slice(0, 200)}`] }
  }

  const data = await response.json()
  const events = (data.value ?? []) as Array<{
    id: string
    subject: string
    body: { content: string } | null
    start: { dateTime: string; timeZone: string }
    end: { dateTime: string; timeZone: string }
    isAllDay: boolean
    location: { displayName: string } | null
  }>

  if (events.length === 0) return { synced: 0, created: 0, errors: [] }

  const isDefault = calendarId === tokenRow.email // heuristic
  const errors: string[] = []

  // Load existing sync rows in batch
  const msEventIds = events.map((e) => e.id)
  const { data: existingSyncRows, error: syncLoadError } = await supabaseService
    .from('ms_cal_sync')
    .select('id, calendar_event_id, ms_event_id')
    .in('ms_event_id', msEventIds)

  if (syncLoadError && errors.length < 5) {
    errors.push(`ms_cal_sync load: ${syncLoadError.message}`)
  }

  const syncByMsId = new Map(
    (existingSyncRows ?? []).map((row: { id: string; calendar_event_id: string; ms_event_id: string }) => [
      row.ms_event_id,
      row,
    ])
  )

  // Check which linked calendar_events still exist
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

  // Clean up orphaned sync rows
  const orphanedSyncIds = (existingSyncRows ?? [])
    .filter((row: { calendar_event_id: string }) => !existingEventIds.has(row.calendar_event_id))
    .map((row: { id: string }) => row.id)

  if (orphanedSyncIds.length > 0) {
    await supabaseService.from('ms_cal_sync').delete().in('id', orphanedSyncIds)
  }

  let synced = 0
  let created = 0

  for (const msEvent of events) {
    if (!msEvent.id || !msEvent.subject) continue

    const start_at = toLocalDateTime(msEvent.start)
    const end_at = toLocalDateTime(msEvent.end)
    if (!start_at || !end_at) continue

    const existing = syncByMsId.get(msEvent.id)

    if (existing && existingEventIds.has(existing.calendar_event_id)) {
      // Update existing event
      await supabaseService
        .from('calendar_events')
        .update({
          title: msEvent.subject,
          description: msEvent.body?.content || null,
          location: msEvent.location?.displayName || null,
          start_at,
          end_at,
          all_day: msEvent.isAllDay,
          source: 'microsoft',
          external_uid: msEvent.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.calendar_event_id)

      synced++
      continue
    }

    // Insert new event
    const { data: newEvent, error } = await supabaseService
      .from('calendar_events')
      .insert({
        title: msEvent.subject,
        description: msEvent.body?.content || null,
        location: msEvent.location?.displayName || null,
        start_at,
        end_at,
        all_day: msEvent.isAllDay,
        source: 'microsoft',
        external_uid: msEvent.id,
        read_only: !isDefault,
        ...(userId ? { user_id: userId } : {}),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single<{ id: string }>()

    if (error || !newEvent) {
      if (error && errors.length < 5) {
        errors.push(`insert "${msEvent.subject}": ${error.message}`)
      }
      continue
    }

    await supabaseService.from('ms_cal_sync').insert({
      calendar_event_id: newEvent.id,
      ms_event_id: msEvent.id,
      ms_calendar_id: calendarId,
      microsoft_token_id: tokenRow.id,
      sync_direction: isDefault ? 'both' : 'pull',
    })

    created++
    synced++
  }

  return { synced, created, errors }
}

// ========================================
// Sync all Microsoft accounts
// ========================================

export async function syncAllMicrosoftAccounts(
  days: number = 30,
  userId?: string
): Promise<{
  accounts: Array<{
    email: string
    calendars: Array<{ name: string; synced: number; created: number; error?: string }>
    error?: string
  }>
  totalPushed: number
  totalPulled: number
}> {
  const tokens = await getAllMicrosoftTokens()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const timeMin = monthStart.toISOString()
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const accounts: Array<{
    email: string
    calendars: Array<{ name: string; synced: number; created: number; error?: string }>
    error?: string
  }> = []
  let totalPushed = 0
  let totalPulled = 0

  for (const tokenRow of tokens) {
    const selections = await getCalendarSelections(tokenRow.id)
    const enabledSelections = selections.filter((s) => s.enabled)

    const calendarResults: Array<{ name: string; synced: number; created: number; error?: string }> = []

    if (enabledSelections.length === 0) {
      accounts.push({ email: tokenRow.email ?? 'Unknown', calendars: [], error: 'No calendars enabled' })
      continue
    }

    for (const sel of enabledSelections) {
      try {
        // Pull events
        if (sel.sync_direction === 'pull' || sel.sync_direction === 'both') {
          const result = await pullEventsFromMicrosoftCalendar(
            tokenRow,
            sel.ms_calendar_id,
            timeMin,
            timeMax,
            userId
          )
          totalPulled += result.synced
          calendarResults.push({
            name: sel.name,
            synced: result.synced,
            created: result.created,
            error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
          })
        }

        // Push events (for calendars with push/both)
        if (sel.sync_direction === 'push' || sel.sync_direction === 'both') {
          const { data: localEvents } = await supabaseService
            .from('calendar_events')
            .select('*')
            .eq('source', 'manual')

          const { data: syncRows } = await supabaseService
            .from('ms_cal_sync')
            .select('calendar_event_id')

          const syncedIds = new Set(
            (syncRows ?? []).map((row: { calendar_event_id: string }) => row.calendar_event_id)
          )
          const unsyncedEvents = ((localEvents ?? []) as CalendarEvent[]).filter(
            (event) => !syncedIds.has(event.id)
          )

          for (const event of unsyncedEvents) {
            try {
              await pushEventToMicrosoft(event, tokenRow.id)
              totalPushed++
            } catch (pushErr) {
              if (calendarResults.length < 5) {
                calendarResults.push({
                  name: sel.name,
                  synced: 0,
                  created: 0,
                  error: pushErr instanceof Error ? pushErr.message : 'Push failed',
                })
              }
            }
          }
        }
      } catch (calError) {
        calendarResults.push({
          name: sel.name,
          synced: 0,
          created: 0,
          error: calError instanceof Error ? calError.message : 'Unknown error',
        })
      }
    }

    accounts.push({ email: tokenRow.email ?? 'Unknown', calendars: calendarResults })
  }

  return { accounts, totalPushed, totalPulled }
}
