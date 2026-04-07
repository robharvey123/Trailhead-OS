import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import type { CalendarFeed } from '@/lib/calendar/feeds'
import { fetchAndSyncFeed } from '@/lib/calendar/feeds'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data: feed, error } = await auth.supabase
    .from('calendar_feeds')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
  }

  const result = await fetchAndSyncFeed(feed as CalendarFeed)

  return NextResponse.json(result)
}
