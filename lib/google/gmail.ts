import { google, type gmail_v1 } from 'googleapis'
import type { EmailLog } from '@/lib/types'
import { getAuthenticatedClient } from './oauth'

export async function getGmailClient() {
  const auth = await getAuthenticatedClient()
  return google.gmail({ version: 'v1', auth })
}

export async function getEmailsForContact(contactEmail: string, maxResults = 20) {
  const gmail = await getGmailClient()

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: `from:${contactEmail} OR to:${contactEmail}`,
    maxResults,
  })

  if (!response.data.messages) {
    return []
  }

  const messages = await Promise.all(
    response.data.messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      })

      return detail.data
    })
  )

  return messages
}

function decodeBase64Url(value?: string | null) {
  if (!value) {
    return ''
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

function extractMessageBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) {
    return ''
  }

  const htmlPart = payload.parts?.find(part => part.mimeType === 'text/html')
  if (htmlPart?.body?.data) {
    return decodeBase64Url(htmlPart.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const textPart = payload.parts?.find(part => part.mimeType === 'text/plain')
  if (textPart?.body?.data) {
    return decodeBase64Url(textPart.body.data).trim()
  }

  const nestedPart = payload.parts?.find(part => part.parts?.length)
  if (nestedPart) {
    return extractMessageBody(nestedPart)
  }

  return decodeBase64Url(payload.body?.data).trim()
}

export async function sendEmail({
  to,
  subject,
  body,
  replyToMessageId,
}: {
  to: string
  subject: string
  body: string
  replyToMessageId?: string
}) {
  const gmail = await getGmailClient()

  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\n')

  const encoded = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const params: {
    userId: string
    requestBody: {
      raw: string
      threadId?: string
    }
  } = {
    userId: 'me',
    requestBody: { raw: encoded },
  }

  if (replyToMessageId) {
    params.requestBody.threadId = replyToMessageId
  }

  return gmail.users.messages.send(params)
}

export function parseGmailMessage(msg: gmail_v1.Schema$Message): Partial<EmailLog> {
  const headers = msg.payload?.headers || []
  const get = (name: string) =>
    headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name === name)?.value || ''

  return {
    gmail_message_id: msg.id ?? undefined,
    gmail_thread_id: msg.threadId ?? undefined,
    from_address: get('From'),
    to_addresses: [get('To')],
    subject: get('Subject'),
    snippet: msg.snippet?.slice(0, 200),
    body_html: extractMessageBody(msg.payload) || undefined,
    received_at: msg.internalDate
      ? new Date(Number.parseInt(msg.internalDate, 10)).toISOString()
      : undefined,
  }
}
