import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/lib/email/resend'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

// Reject anything larger than this before parsing.
const MAX_BODY_BYTES = 50_000
// Accepted contact sends allowed per rolling hour before the endpoint 429s.
const HOURLY_CONTACT_LIMIT = 20
const MAX_SHORT = 200
const MAX_MESSAGE = 2_000

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function cappedString(value: unknown, max: number) {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    body = {}
  }

  // Honeypot: hidden `website` field. Populated → bot. Silent success.
  if (cappedString(body.website, MAX_SHORT)) {
    return NextResponse.json({ ok: true })
  }

  const name = cappedString(body.name, MAX_SHORT)
  const email = cappedString(body.email, MAX_SHORT)
  const company = cappedString(body.company, MAX_SHORT)
  const interest = cappedString(body.interest, MAX_SHORT) ?? 'General'
  const message = cappedString(body.message, MAX_MESSAGE)

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'name, email, and message are required' },
      { status: 400 }
    )
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'email must be valid' }, { status: 400 })
  }

  // Rolling hourly cap. The contact form doesn't persist a record of its own, so
  // we count throttle events in public_form_events via a SECURITY DEFINER helper
  // (anon can't read the table back). Fail-open if the count errors.
  const supabase = await createSupabaseClient()
  const { data: recentCount, error: countError } = await supabase.rpc(
    'count_recent_public_form_events',
    { p_bucket: 'contact' }
  )
  if (!countError && typeof recentCount === 'number' && recentCount >= HOURLY_CONTACT_LIMIT) {
    return NextResponse.json({ error: 'Too many requests, please try again later' }, { status: 429 })
  }

  const notificationEmail = process.env.NOTIFICATION_EMAIL

  try {
    if (notificationEmail && resend) {
      await resend.emails.send({
        from: 'Trailhead Website <notifications@trailheadholdings.uk>',
        to: [notificationEmail],
        subject: `Website enquiry — ${interest} — ${name}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; color: #0F172A; line-height: 1.7;">
            <h1 style="font-size: 20px; margin-bottom: 16px;">New website enquiry</h1>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Company:</strong> ${escapeHtml(company ?? 'Not provided')}</p>
            <p><strong>Interest:</strong> ${escapeHtml(interest)}</p>
            <p><strong>Message:</strong></p>
            <div style="padding: 16px; border-radius: 16px; background: #F8FAFC; border: 1px solid #E2E8F0;">
              ${escapeHtml(message).replace(/\n/g, '<br />')}
            </div>
          </div>
        `,
      })
    }
  } catch (error) {
    console.error('Failed to send marketing contact email', error)
  }

  // Record this accepted submission so the hourly cap can count it next time.
  const { error: eventError } = await supabase.from('public_form_events').insert({ bucket: 'contact' })
  if (eventError) {
    console.error('Failed to record contact throttle event', eventError)
  }

  return NextResponse.json({ ok: true })
}
