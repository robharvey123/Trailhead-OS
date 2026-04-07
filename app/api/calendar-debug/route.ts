import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { supabaseService } from '@/lib/supabase/service'

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  // Check if source column exists by trying a filtered query
  let sourceColumnExists = true
  const { error: sourceCheckError } = await supabaseService
    .from('calendar_events')
    .select('id')
    .eq('source', 'google')
    .limit(1)
  if (sourceCheckError) {
    sourceColumnExists = false
  }

  // Try a test insert with service role to see if it works
  let testInsertError: string | null = null
  const { data: testEvent, error: insertError } = await supabaseService
    .from('calendar_events')
    .insert({
      title: '__debug_test__',
      start_at: new Date().toISOString(),
      end_at: new Date().toISOString(),
      all_day: false,
      source: 'google',
      external_uid: '__debug_test__',
      read_only: true,
    })
    .select('id')
    .single()
  
  if (insertError) {
    testInsertError = `${insertError.message} (code: ${insertError.code}, details: ${insertError.details}, hint: ${insertError.hint})`
  } else if (testEvent) {
    // Clean up test event
    await supabaseService.from('calendar_events').delete().eq('id', (testEvent as { id: string }).id)
  }

  const supabase = auth.supabase

  // Count events by source
  const { data: sourceCounts } = await supabase
    .from('calendar_events')
    .select('source')

  const counts = { manual: 0, google: 0, feed: 0, total: 0 }
  for (const row of sourceCounts ?? []) {
    const s = (row as { source: string }).source as keyof typeof counts
    if (s in counts) counts[s]++
    counts.total++
  }

  // Get a few sample google events
  const { data: sampleGoogle } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, all_day, source, colour')
    .eq('source', 'google')
    .order('start_at', { ascending: false })
    .limit(5)

  // Get a few sample feed events
  const { data: sampleFeed } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, all_day, source, colour')
    .eq('source', 'feed')
    .order('start_at', { ascending: false })
    .limit(5)

  // Get feeds status
  const { data: feeds } = await supabase
    .from('calendar_feeds')
    .select('id, name, url, enabled, last_fetched_at, last_error, event_count')

  // Get google tokens
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('id, email, label')

  // Get google calendar selections
  const { data: selections } = await supabase
    .from('google_calendar_selections')
    .select('id, google_token_id, gcal_calendar_id, name, enabled, sync_direction')

  // Check what the current month query would return
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const { data: currentMonthEvents, count: monthCount } = await supabase
    .from('calendar_events')
    .select('id, title, source', { count: 'exact' })
    .gte('start_at', monthStart)
    .lte('start_at', monthEnd)

  const monthBySource = { manual: 0, google: 0, feed: 0 }
  for (const row of currentMonthEvents ?? []) {
    const s = (row as { source: string }).source as keyof typeof monthBySource
    if (s in monthBySource) monthBySource[s]++
  }

  // Count gcal_sync rows
  const { data: syncRows } = await supabase
    .from('gcal_sync')
    .select('id')

  return NextResponse.json({
    sourceColumnExists,
    testInsertError,
    gcalSyncRowCount: syncRows?.length ?? 0,
    counts,
    currentMonth: {
      range: { start: monthStart, end: monthEnd },
      total: monthCount,
      bySource: monthBySource,
    },
    sampleGoogle,
    sampleFeed,
    feeds,
    googleTokens: tokens,
    googleSelections: selections,
  })
}
