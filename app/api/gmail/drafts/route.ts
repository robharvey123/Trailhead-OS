import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { createDraft, listDrafts, type OutboundMessage } from '@/lib/google/gmail'

/** Parse the shared outbound payload from a request body. */
export function parseOutbound(body: Record<string, unknown>): OutboundMessage & { threadId?: string } {
  return {
    to: typeof body.to === 'string' ? body.to : '',
    cc: typeof body.cc === 'string' ? body.cc : undefined,
    bcc: typeof body.bcc === 'string' ? body.bcc : undefined,
    subject: typeof body.subject === 'string' ? body.subject : '',
    body: typeof body.body === 'string' ? body.body : '',
    inReplyTo: typeof body.in_reply_to === 'string' ? body.in_reply_to : undefined,
    references: typeof body.references === 'string' ? body.references : undefined,
    attachments: Array.isArray(body.attachments) ? (body.attachments as OutboundMessage['attachments']) : undefined,
    threadId: typeof body.thread_id === 'string' ? body.thread_id : undefined,
  }
}

export async function GET() {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const drafts = await listDrafts()
    return NextResponse.json({ drafts })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load drafts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const draft = await createDraft(parseOutbound(body))
    return NextResponse.json(draft)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create draft' }, { status: 500 })
  }
}
