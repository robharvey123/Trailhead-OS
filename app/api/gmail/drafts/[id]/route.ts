import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { updateDraft, deleteDraft, sendDraft, getDraft } from '@/lib/google/gmail'
import { parseOutbound } from '../route'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const { id } = await params
    return NextResponse.json({ draft: await getDraft(id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load draft' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    await updateDraft(id, parseOutbound(body))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update draft' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { ok, response } = await getAuthenticatedSupabase()
  if (!ok) return response
  try {
    const { id } = await params
    await deleteDraft(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete draft' }, { status: 500 })
  }
}

// Send an existing draft. Uses drafts.send so Gmail removes the draft itself.
// The optional payload is only used to log the sent message into email_logs so
// the thread updates immediately (same shape the send route logs).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) return auth.response
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const sent = await sendDraft(id)

    const splitAddrs = (v: unknown) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [])
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    await auth.supabase.from('email_logs').insert({
      gmail_message_id: sent.id ?? null,
      gmail_thread_id: sent.threadId ?? null,
      account_id: str(body.account_id),
      contact_id: str(body.contact_id),
      direction: 'outbound',
      from_address: auth.user.email ?? '',
      to_addresses: splitAddrs(body.to),
      cc_addresses: splitAddrs(body.cc),
      bcc_addresses: splitAddrs(body.bcc),
      subject: str(body.subject) ?? '',
      snippet: (typeof body.body === 'string' ? body.body.replace(/<[^>]+>/g, ' ') : '').slice(0, 200),
      body_html: str(body.body),
      sent_at: new Date().toISOString(),
    }).then(() => {}, () => {})

    return NextResponse.json({ ok: true, message_id: sent.id ?? null, thread_id: sent.threadId ?? null })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to send draft' }, { status: 500 })
  }
}
