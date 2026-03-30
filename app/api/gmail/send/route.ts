import { NextResponse } from 'next/server'
import { getAuthenticatedSupabase } from '@/lib/api/auth'
import { sendEmail } from '@/lib/google/gmail'

function sanitizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const to = sanitizeOptionalString(body.to)
  const subject = sanitizeOptionalString(body.subject)
  const htmlBody = sanitizeOptionalString(body.body)
  const replyToMessageId = sanitizeOptionalString(body.reply_to_message_id) ?? undefined

  if (!to || !subject || !htmlBody) {
    return NextResponse.json(
      { error: 'to, subject, and body are required' },
      { status: 400 }
    )
  }

  try {
    const response = await sendEmail({
      to,
      subject,
      body: htmlBody,
      replyToMessageId,
    })

    const messageId = response.data.id ?? null

    const { error: logError } = await auth.supabase.from('email_logs').insert({
      gmail_message_id: messageId,
      gmail_thread_id: response.data.threadId ?? replyToMessageId ?? null,
      account_id: sanitizeOptionalString(body.account_id),
      contact_id: sanitizeOptionalString(body.contact_id),
      enquiry_id: sanitizeOptionalString(body.enquiry_id),
      quote_id: sanitizeOptionalString(body.quote_id),
      direction: 'outbound',
      from_address: auth.user.email ?? '',
      to_addresses: [to],
      subject,
      snippet: htmlBody.slice(0, 200),
      body_html: htmlBody,
      sent_at: new Date().toISOString(),
    })

    if (logError) {
      throw new Error(logError.message)
    }

    return NextResponse.json({
      success: true,
      message_id: messageId,
      thread_id: response.data.threadId ?? null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    )
  }
}
