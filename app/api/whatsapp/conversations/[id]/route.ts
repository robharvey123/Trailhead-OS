import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getConversation, listMessages } from '@/lib/db/whatsapp'

// GET — one conversation with participants, plus a page of messages (newest first).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const sp = request.nextUrl.searchParams
    const conversation = await getConversation(id, supabase)
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    const limit = Math.min(Math.max(Number(sp.get('limit') ?? '50') || 50, 1), 500)
    const messages = await listMessages(id, { includeDrafts: sp.get('include_drafts') !== '0', limit, before: sp.get('before') ?? undefined }, supabase)
    return NextResponse.json({ conversation, messages })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load conversation' }, { status: 500 })
  }
}

// PATCH — file the conversation under an account / engagement, retitle, or flag personal.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    for (const key of ['account_id', 'engagement_id'] as const) {
      if (key in body) {
        if (body[key] !== null && typeof body[key] !== 'string') return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 })
        patch[key] = body[key] || null
      }
    }
    if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim()
    if (typeof body.is_personal === 'boolean') patch.is_personal = body.is_personal
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { error } = await supabase.from('whatsapp_conversations').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Messages inherit account/engagement from the conversation.
    const inherit: Record<string, unknown> = {}
    if ('account_id' in patch) inherit.account_id = patch.account_id
    if ('engagement_id' in patch) inherit.engagement_id = patch.engagement_id
    if (Object.keys(inherit).length) await supabase.from('whatsapp_messages').update(inherit).eq('conversation_id', id)

    const conversation = await getConversation(id, supabase)
    return NextResponse.json({ conversation })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const { error } = await supabase.from('whatsapp_conversations').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 })
  }
}
