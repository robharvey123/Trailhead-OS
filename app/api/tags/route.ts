import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as tags from '@/lib/db/tags'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const list = await tags.listTags(supabase)
    return NextResponse.json({ tags: list })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tags'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const body = await request.json()
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const tag = await tags.upsertTag({ name: body.name, color: body.color }, supabase)
    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create tag'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
