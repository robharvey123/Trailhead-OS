import { getAuthenticatedSupabase } from '@/lib/api/auth'
import {
  getThreadMessages,
  setThreadRead,
  setThreadStarred,
  linkThread,
  unlinkThread,
  archiveThread,
  unarchiveThread,
  trashThread,
  untrashThread,
} from '@/lib/db/inbox'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { threadId } = await params
    const messages = await getThreadMessages(threadId, supabase)
    return NextResponse.json({ messages })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load thread'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH { action: 'read'|'unread'|'star'|'unstar'|'link'|'unlink'|'archive'|'unarchive'|'trash'|'untrash', account_id?, contact_id? }
// For 'link': contact_id omitted leaves the contact as-is, null clears it, a string sets it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const { threadId } = await params
    const body = await request.json()

    switch (body.action) {
      case 'read': await setThreadRead(threadId, false, supabase); break
      case 'unread': await setThreadRead(threadId, true, supabase); break
      case 'star': await setThreadStarred(threadId, true, supabase); break
      case 'unstar': await setThreadStarred(threadId, false, supabase); break
      case 'archive': await archiveThread(threadId, supabase); break
      case 'unarchive': await unarchiveThread(threadId, supabase); break
      case 'trash': await trashThread(threadId, supabase); break
      case 'untrash': await untrashThread(threadId, supabase); break
      case 'link': {
        if (!body.account_id) return NextResponse.json({ error: 'account_id required' }, { status: 400 })
        const contactId = typeof body.contact_id === 'string' ? body.contact_id : body.contact_id === null ? null : undefined
        await linkThread(threadId, body.account_id, contactId, supabase)
        break
      }
      case 'unlink': await unlinkThread(threadId, supabase); break
      default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update thread'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
