import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { supabaseService } from '@/lib/supabase/service'

// Resend delivery-event webhook. Signed with Svix (Resend uses Svix under the
// hood); verify against RESEND_WEBHOOK_SECRET. No user session here — service role.
// Only events that match an outreach_sends row are recorded; other Resend emails
// (invoices, notifications) share this webhook and are acked and ignored.

type ResendEvent = {
  type: string
  created_at?: string
  data: { email_id?: string; to?: string | string[]; created_at?: string }
}

// Furthest engagement wins, so out-of-order opens don't clobber a click.
const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, clicked: 4 }

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })

  const payload = await request.text()
  let evt: ResendEvent
  try {
    evt = new Webhook(secret).verify(payload, {
      'svix-id': request.headers.get('svix-id') ?? '',
      'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
      'svix-signature': request.headers.get('svix-signature') ?? '',
    }) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = supabaseService
  const resendId = evt.data?.email_id
  if (!resendId) return NextResponse.json({ ok: true })

  const { data: sendRow } = await db.from('outreach_sends').select('*').eq('resend_email_id', resendId).maybeSingle<{
    id: string; recipient_id: string; status: string; first_opened_at: string | null; first_clicked_at: string | null
  }>()
  // Not an outreach email — ack and ignore.
  if (!sendRow) return NextResponse.json({ ok: true })
  const send = sendRow

  const now = new Date().toISOString()
  const occurredAt = evt.data?.created_at ?? evt.created_at ?? now

  // Raw landing record (never updated).
  await db.from('outreach_events').insert({
    send_id: send.id, resend_email_id: resendId, type: evt.type, payload: evt as unknown as Record<string, unknown>, occurred_at: occurredAt,
  })

  // Suppress the address + stop the recipient's sequence (bounce/complaint).
  const stopRecipient = async (reason: 'bounced' | 'complained') => {
    const to = Array.isArray(evt.data.to) ? evt.data.to[0] : evt.data.to
    if (to) {
      await db.from('email_suppressions').insert({ email: to, reason, source: 'resend' }).then(() => {}, () => {})
    }
    await db.from('outreach_recipients').update({ status: 'stopped', stopped_reason: reason, stopped_at: now }).eq('id', send.recipient_id)
  }

  const patch: Record<string, unknown> = {}
  const advanceStatus = (next: string) => {
    if ((RANK[next] ?? -1) > (RANK[send.status] ?? -1)) patch.status = next
  }

  switch (evt.type) {
    case 'email.sent': advanceStatus('sent'); patch.sent_at = now; break
    case 'email.delivered': advanceStatus('delivered'); patch.delivered_at = now; break
    case 'email.opened': advanceStatus('opened'); if (!send.first_opened_at) patch.first_opened_at = occurredAt; break
    case 'email.clicked': advanceStatus('clicked'); if (!send.first_clicked_at) patch.first_clicked_at = occurredAt; break
    case 'email.failed': patch.status = 'failed'; patch.error = 'Resend reported failed'; break
    case 'email.delivery_delayed': break // event recorded, no status change
    case 'email.bounced': patch.status = 'bounced'; await stopRecipient('bounced'); break
    case 'email.complained': patch.status = 'complained'; await stopRecipient('complained'); break
    default: break
  }

  if (Object.keys(patch).length > 0) {
    await db.from('outreach_sends').update(patch).eq('id', send.id)
  }

  return NextResponse.json({ ok: true })
}
