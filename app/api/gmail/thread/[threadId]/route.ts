import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getGmailClient, extractBodies, collectAttachments } from '@/lib/google/gmail'
import { parseAddress, parseAddressList } from '@/lib/google/autolink'
import type { EmailLog } from '@/lib/types'

// GET /api/gmail/thread/[threadId] — fetch a thread's messages live from Gmail
// (format:full), for opening a remote search result that isn't in email_logs.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const { threadId } = await params
    const gmail = await getGmailClient()
    const { data } = await gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' })

    const messages: Partial<EmailLog>[] = (data.messages ?? []).map((msg) => {
      const headers = msg.payload?.headers ?? []
      const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
      const from = parseAddress(h('From'))
      const labels = msg.labelIds ?? []
      const direction: 'inbound' | 'outbound' = labels.includes('SENT') ? 'outbound' : 'inbound'
      const { html, text } = extractBodies(msg.payload)
      const ts = msg.internalDate ? new Date(Number.parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString()
      return {
        id: msg.id ?? threadId,
        gmail_message_id: msg.id ?? undefined,
        gmail_thread_id: threadId,
        direction,
        from_address: from.email,
        from_name: from.name,
        to_addresses: parseAddressList(h('To')),
        cc_addresses: parseAddressList(h('Cc')),
        subject: h('Subject'),
        snippet: msg.snippet ?? '',
        body_html: html,
        body_text: text,
        attachments: collectAttachments(msg.payload),
        received_at: direction === 'inbound' ? ts : undefined,
        sent_at: direction === 'outbound' ? ts : undefined,
        created_at: ts,
      }
    })

    return NextResponse.json({ messages })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load thread' }, { status: 500 })
  }
}
