import { NextRequest, NextResponse } from 'next/server'
import { resend } from '@/lib/email/resend'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function optionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const name = optionalString(body.name)
  const email = optionalString(body.email)
  const company = optionalString(body.company)
  const interest = optionalString(body.interest) ?? 'General'
  const message = optionalString(body.message)

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'name, email, and message are required' },
      { status: 400 }
    )
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'email must be valid' }, { status: 400 })
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

  return NextResponse.json({ ok: true })
}
