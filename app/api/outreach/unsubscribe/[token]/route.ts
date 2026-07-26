import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase/service'
import { applyUnsubscribe } from '@/lib/outreach/unsubscribe'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.trailheadholdings.uk').replace(/\/$/, '')

// GET is RENDER-ONLY — it must not mutate, because mail-security scanners
// (Mimecast, Barracuda, Outlook Safe Links) prefetch every link in an inbound
// message. It just sends the recipient to the confirmation page.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return NextResponse.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, APP_URL))
}

// POST is a genuine user action: the confirm-page button and RFC 8058 one-click.
// Always 200 even for an unknown token, so the endpoint can't enumerate recipients.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  await applyUnsubscribe(supabaseService, token).catch(() => {})
  return NextResponse.json({ ok: true })
}
