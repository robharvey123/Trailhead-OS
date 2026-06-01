import { getAuthenticatedSupabase } from '@/lib/api/auth'
import * as tags from '@/lib/db/tags'
import { NextRequest, NextResponse } from 'next/server'

// POST { tag_id } — attach a tag to this account
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    const body = await request.json()
    if (!body.tag_id) {
      return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })
    }

    await tags.tagAccount(id, body.tag_id, supabase)
    const list = await tags.tagsForAccount(id, supabase)
    return NextResponse.json({ tags: list }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to tag account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE ?tag_id=... — remove a tag from this account
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { id } = await params
    const tagId = new URL(request.url).searchParams.get('tag_id')
    if (!tagId) {
      return NextResponse.json({ error: 'tag_id is required' }, { status: 400 })
    }

    await tags.untagAccount(id, tagId, supabase)
    return NextResponse.json({})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to untag account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
