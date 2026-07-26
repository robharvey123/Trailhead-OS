import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

// Suppress the address, flag the contact do_not_email, and stop the sequence.
// Never signals whether the token was valid — always succeeds, so the endpoint
// can't be used to enumerate recipients.
async function applyUnsubscribe(token: string) {
  const db = supabaseService
  const { data: recipient } = await db
    .from('outreach_recipients')
    .select('id, contact_id')
    .eq('unsubscribe_token', token)
    .maybeSingle<{ id: string; contact_id: string }>()
  if (!recipient) return

  const { data: contact } = await db.from('contacts').select('email').eq('id', recipient.contact_id).maybeSingle<{ email: string | null }>()
  if (contact?.email) {
    await db.from('email_suppressions').insert({ email: contact.email, reason: 'unsubscribed', source: 'unsubscribe-link' }).then(() => {}, () => {})
    await db.from('contacts').update({ do_not_email: true }).eq('id', recipient.contact_id)
  }
  await db.from('outreach_recipients').update({ status: 'stopped', stopped_reason: 'unsubscribed', stopped_at: new Date().toISOString() }).eq('id', recipient.id)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await applyUnsubscribe(token).catch(() => {})
  return NextResponse.redirect(new URL('/unsubscribed', APP_URL))
}

// One-click unsubscribe (List-Unsubscribe-Post). Always 200.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await applyUnsubscribe(token).catch(() => {})
  return NextResponse.json({ ok: true })
}
