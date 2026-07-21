import { getAuthenticatedSupabase } from '@/lib/api/auth'
import {
  setThreadRead,
  setThreadStarred,
  archiveThread,
  unarchiveThread,
  trashThread,
  untrashThread,
} from '@/lib/db/inbox'
import { NextRequest, NextResponse } from 'next/server'

type BulkAction = 'read' | 'unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'

// Each action hits Gmail's threads.modify — keep the loop sequential (do NOT
// parallelize) to stay within rate limits. Capped per request.
const MAX_THREADS = 50

async function applyOne(action: BulkAction, threadId: string, supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>['supabase']) {
  switch (action) {
    case 'read': return setThreadRead(threadId, false, supabase)
    case 'unread': return setThreadRead(threadId, true, supabase)
    case 'star': return setThreadStarred(threadId, true, supabase)
    case 'unstar': return setThreadStarred(threadId, false, supabase)
    case 'archive': return archiveThread(threadId, supabase)
    case 'unarchive': return unarchiveThread(threadId, supabase)
    case 'trash': return trashThread(threadId, supabase)
    case 'untrash': return untrashThread(threadId, supabase)
  }
}

// POST { thread_ids: string[], action: BulkAction }
export async function POST(request: NextRequest) {
  try {
    const { ok, response: authResponse, supabase } = await getAuthenticatedSupabase()
    if (!ok) return authResponse

    const body = await request.json().catch(() => ({})) as { thread_ids?: unknown; action?: unknown }
    const action = body.action as BulkAction
    const threadIds = Array.isArray(body.thread_ids) ? body.thread_ids.filter((x): x is string => typeof x === 'string') : []

    const VALID: BulkAction[] = ['read', 'unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash']
    if (!VALID.includes(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    if (threadIds.length === 0) return NextResponse.json({ error: 'thread_ids required' }, { status: 400 })
    if (threadIds.length > MAX_THREADS) return NextResponse.json({ error: `Too many threads (max ${MAX_THREADS})` }, { status: 400 })

    const failures: Array<{ thread_id: string; error: string }> = []
    let succeeded = 0
    for (const threadId of threadIds) {
      try {
        await applyOne(action, threadId, supabase)
        succeeded++
      } catch (err) {
        failures.push({ thread_id: threadId, error: err instanceof Error ? err.message : 'Failed' })
      }
    }

    return NextResponse.json({ ok: true, succeeded, failures })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
