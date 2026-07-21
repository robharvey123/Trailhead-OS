import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { searchMessageRefs, getGmailClient } from '@/lib/google/gmail'
import { parseAddress } from '@/lib/google/autolink'
import type { EmailThread } from '@/lib/types'

// GET /api/gmail/search?q=  — full-mailbox Gmail search (supports from:, has:attachment,
// before:, etc.). Returns transient thread summaries for results NOT already in
// email_logs, each flagged remote:true. Local matches surface via the normal search.
export async function GET(request: NextRequest) {
  const { ok, response, supabase } = await getAuthenticatedSupabase()
  if (!ok) return response

  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ threads: [] })

  try {
    const refs = await searchMessageRefs(q, 50)
    // One representative message per thread (first match).
    const byThread = new Map<string, string>()
    for (const r of refs) if (!byThread.has(r.threadId)) byThread.set(r.threadId, r.id)
    const threadIds = [...byThread.keys()]
    if (threadIds.length === 0) return NextResponse.json({ threads: [] })

    const { data: known } = await supabase
      .from('email_logs')
      .select('gmail_thread_id')
      .in('gmail_thread_id', threadIds)
    const knownSet = new Set((known ?? []).map((k) => k.gmail_thread_id as string))
    const remoteThreadIds = threadIds.filter((id) => !knownSet.has(id))

    const gmail = await getGmailClient()
    const results: Array<EmailThread & { remote: boolean }> = []
    for (const threadId of remoteThreadIds) {
      const messageId = byThread.get(threadId)!
      try {
        const { data: msg } = await gmail.users.messages.get({
          userId: 'me', id: messageId, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'],
        })
        const headers = msg.payload?.headers ?? []
        const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
        const from = parseAddress(h('From'))
        const labels = msg.labelIds ?? []
        const ts = msg.internalDate ? new Date(Number.parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString()
        results.push({
          gmail_thread_id: threadId,
          account_id: null,
          account_name: null,
          subject: h('Subject') || '(no subject)',
          snippet: msg.snippet ?? '',
          from_name: from.name || from.email,
          from_address: from.email,
          last_at: ts,
          message_count: 1,
          is_unread: labels.includes('UNREAD'),
          is_starred: labels.includes('STARRED'),
          in_inbox: labels.includes('INBOX'),
          match_method: null,
          has_attachments: false,
          has_outbound: labels.includes('SENT'),
          in_trash: labels.includes('TRASH'),
          remote: true,
        })
      } catch {
        // skip individual failures
      }
    }
    return NextResponse.json({ threads: results })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 })
  }
}
