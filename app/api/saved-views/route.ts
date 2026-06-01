import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as savedViews from '@/lib/db/saved-views'
import type { SavedViewEntity } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const entity = new URL(request.url).searchParams.get('entity') as SavedViewEntity | null
    const views = await savedViews.listSavedViews(entity || undefined, supabase)
    return NextResponse.json({ views })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch saved views'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const body = await request.json()
    if (!body.entity || !body.name?.trim()) {
      return NextResponse.json({ error: 'entity and name are required' }, { status: 400 })
    }

    const view = await savedViews.upsertSavedView(body, supabase)
    return NextResponse.json({ view }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save view'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
