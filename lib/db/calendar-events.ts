import { createClient } from '@/lib/supabase/server'
import type { CalendarEvent } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export interface CalendarEventFilters {
  start_at_gte?: string
  start_at_lte?: string
  workstream_id?: string | null
  contact_id?: string | null
  project_id?: string | null
}

export interface CreateCalendarEventInput {
  title: string
  description?: string | null
  start_at: string
  end_at: string
  all_day?: boolean
  workstream_id?: string | null
  contact_id?: string | null
  project_id?: string | null
  location?: string | null
  colour?: string | null
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>

export async function getCalendarEvents(
  filters: CalendarEventFilters = {},
  client?: SupabaseClient
): Promise<CalendarEvent[]> {
  const supabase = await getSupabase(client)
  let query = supabase
    .from('calendar_events')
    .select('*')
    .order('start_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (filters.start_at_gte) {
    query = query.gte('start_at', filters.start_at_gte)
  }

  if (filters.start_at_lte) {
    query = query.lte('start_at', filters.start_at_lte)
  }

  if (filters.workstream_id) {
    query = query.eq('workstream_id', filters.workstream_id)
  }

  if (filters.contact_id) {
    query = query.eq('contact_id', filters.contact_id)
  }

  if (filters.project_id) {
    query = query.eq('project_id', filters.project_id)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message || 'Failed to load calendar events')
  }

  return (data ?? []) as CalendarEvent[]
}

export async function getCalendarEventById(
  id: string,
  client?: SupabaseClient
): Promise<CalendarEvent | null> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load calendar event')
  }

  return (data as CalendarEvent | null) ?? null
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
  client?: SupabaseClient
): Promise<CalendarEvent> {
  const supabase = await getSupabase(client)
  const title = input.title.trim()

  if (!title) {
    throw new Error('title is required')
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      title,
      description: input.description?.trim() || null,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ?? false,
      workstream_id: input.workstream_id ?? null,
      contact_id: input.contact_id ?? null,
      project_id: input.project_id ?? null,
      location: input.location?.trim() || null,
      colour: input.colour?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create calendar event')
  }

  return data as CalendarEvent
}

export async function updateCalendarEvent(
  id: string,
  input: UpdateCalendarEventInput,
  client?: SupabaseClient
): Promise<CalendarEvent> {
  const supabase = await getSupabase(client)
  const patch: Partial<CalendarEvent> = {
    updated_at: new Date().toISOString(),
  }

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) {
      throw new Error('title cannot be empty')
    }
    patch.title = title
  }

  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null
  }

  if (input.start_at !== undefined) {
    patch.start_at = input.start_at
  }

  if (input.end_at !== undefined) {
    patch.end_at = input.end_at
  }

  if (input.all_day !== undefined) {
    patch.all_day = input.all_day
  }

  if (input.workstream_id !== undefined) {
    patch.workstream_id = input.workstream_id
  }

  if (input.contact_id !== undefined) {
    patch.contact_id = input.contact_id
  }

  if (input.project_id !== undefined) {
    patch.project_id = input.project_id
  }

  if (input.location !== undefined) {
    patch.location = input.location?.trim() || null
  }

  if (input.colour !== undefined) {
    patch.colour = input.colour?.trim() || null
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update calendar event')
  }

  return data as CalendarEvent
}

export async function deleteCalendarEvent(
  id: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('calendar_events').delete().eq('id', id)

  if (error) {
    throw new Error(error.message || 'Failed to delete calendar event')
  }
}
