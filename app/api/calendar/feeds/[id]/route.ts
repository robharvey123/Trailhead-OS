import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data: feed, error } = await auth.supabase
    .from('calendar_feeds')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 })
  }

  return NextResponse.json({ feed })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof body.name === 'string' && body.name.trim()) {
    updates.name = body.name.trim()
  }

  if (typeof body.colour === 'string') {
    updates.colour = body.colour.trim()
  }

  if (typeof body.enabled === 'boolean') {
    updates.enabled = body.enabled
  }

  if (typeof body.refresh_minutes === 'number' && body.refresh_minutes >= 5) {
    updates.refresh_minutes = body.refresh_minutes
  }

  const { data: feed, error } = await auth.supabase
    .from('calendar_feeds')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ feed })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response

  const { id } = await params

  // Delete all events from this feed first
  await auth.supabase.from('calendar_events').delete().eq('feed_id', id)

  const { error } = await auth.supabase
    .from('calendar_feeds')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
