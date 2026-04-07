import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import type { CalendarFeed } from '@/lib/calendar/feeds'
import { fetchAndSyncFeed } from '@/lib/calendar/feeds'

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'webcal:'
  } catch {
    return false
  }
}

function normaliseUrl(value: string): string {
  return value.replace(/^webcal:\/\//, 'https://')
}

export async function GET() {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('calendar_feeds')
    .select('*')
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feeds: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const colour = typeof body.colour === 'string' ? body.colour.trim() : '#6366F1'

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: 'A valid https or webcal URL is required' },
      { status: 400 }
    )
  }

  const { data: feed, error } = await auth.supabase
    .from('calendar_feeds')
    .insert({
      name,
      url: normaliseUrl(url),
      colour,
      enabled: true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Immediately sync the new feed
  const syncResult = await fetchAndSyncFeed(feed as CalendarFeed)

  return NextResponse.json({ feed, sync: syncResult }, { status: 201 })
}
