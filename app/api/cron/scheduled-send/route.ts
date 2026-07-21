import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { sendEmail, type OutboundMessage } from '@/lib/google/gmail'

export const maxDuration = 60

type ScheduledPayload = {
  to?: string
  cc?: string
  bcc?: string
  subject?: string
  body_html?: string
  attachments?: OutboundMessage['attachments']
  in_reply_to?: string
  account_id?: string | null
  contact_id?: string | null
}

/**
 * Every 5 minutes: send scheduled emails whose send_at has passed. Each row is
 * claimed optimistically (pending → sending) so an overlapping tick can't
 * double-send. On success → sent (+ logged to email_logs); on failure → failed.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nowIso = new Date().toISOString()
  const { data: due, error } = await supabaseService
    .from('scheduled_emails')
    .select('id, payload')
    .eq('status', 'pending')
    .lte('send_at', nowIso)
    .limit(25)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) return NextResponse.json({ ok: true, sent: 0 })

  let sent = 0
  const failures: string[] = []

  for (const row of due as Array<{ id: string; payload: ScheduledPayload }>) {
    // Optimistic claim — only proceed if we win the pending → sending transition.
    const { data: claimed } = await supabaseService
      .from('scheduled_emails')
      .update({ status: 'sending' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimed || claimed.length === 0) continue // another run already took it

    const p = row.payload ?? {}
    try {
      const res = await sendEmail({
        to: p.to ?? '',
        cc: p.cc,
        bcc: p.bcc,
        subject: p.subject ?? '',
        body: p.body_html ?? '',
        attachments: p.attachments,
        replyToMessageId: p.in_reply_to,
        inReplyTo: undefined,
      })

      await supabaseService.from('email_logs').insert({
        gmail_message_id: res.data.id ?? null,
        gmail_thread_id: res.data.threadId ?? p.in_reply_to ?? null,
        account_id: p.account_id ?? null,
        contact_id: p.contact_id ?? null,
        direction: 'outbound',
        to_addresses: (p.to ?? '').split(',').map((x) => x.trim()).filter(Boolean),
        cc_addresses: (p.cc ?? '').split(',').map((x) => x.trim()).filter(Boolean),
        subject: p.subject ?? '',
        snippet: res.text.slice(0, 200),
        body_html: res.html,
        body_text: res.text,
        sent_at: new Date().toISOString(),
      }).then(() => {}, () => {})

      await supabaseService.from('scheduled_emails').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', row.id)
      sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send failed'
      failures.push(`${row.id}: ${message}`)
      await supabaseService.from('scheduled_emails').update({ status: 'failed', error: message }).eq('id', row.id)
    }
  }

  return NextResponse.json({ ok: true, sent, errors: failures.length ? failures : undefined })
}
