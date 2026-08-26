import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'

// PATCH — OS-side edits: promote a draft to sent, or flag/unflag client_visible.
// Body edits go through the Cowork endpoint; the OS tick only confirms.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    if (typeof body.is_draft === 'boolean') patch.is_draft = body.is_draft
    if (typeof body.client_visible === 'boolean') patch.client_visible = body.client_visible
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    const { data, error } = await supabase.from('whatsapp_messages').update(patch).eq('id', id).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ message: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ok, response, supabase } = await getAuthenticatedSupabase()
    if (!ok) return response
    const { id } = await params
    const { error } = await supabase.from('whatsapp_messages').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 500 })
  }
}
