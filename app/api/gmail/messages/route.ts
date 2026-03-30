import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { getEmailsForContact, parseGmailMessage } from '@/lib/google/gmail'

export async function GET(request: NextRequest) {
  const gmailIntegrationPaused = true
  if (gmailIntegrationPaused) {
    return NextResponse.json(
      { error: 'Gmail integration is temporarily paused' },
      { status: 410 }
    )
  }

  const auth = await getAuthenticatedSupabase()
  if (!auth.ok) {
    return auth.response
  }

  const contactEmail = request.nextUrl.searchParams.get('contact_email')?.trim()
  const limitParam = request.nextUrl.searchParams.get('limit')
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitParam ?? '20', 10) || 20))

  if (!contactEmail) {
    return NextResponse.json({ error: 'contact_email is required' }, { status: 400 })
  }

  try {
    const messages = await getEmailsForContact(contactEmail, limit)
    return NextResponse.json({ messages: messages.map(parseGmailMessage) })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load Gmail messages'

    return NextResponse.json(
      { error: message },
      { status: message === 'No Google account connected' ? 409 : 500 }
    )
  }
}
