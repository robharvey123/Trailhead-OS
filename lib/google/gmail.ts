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

export interface OutboundAttachment {
  filename: string
  contentType: string
  dataBase64: string // raw base64 (no data: prefix)
}

export async function sendEmail({
  to,
  cc,
  bcc,
  subject,
  body,
  replyToMessageId,
  attachments,
}: {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  replyToMessageId?: string
  attachments?: OutboundAttachment[]
}) {
  const gmail = await getGmailClient()

  const headers = [`To: ${to}`]
  if (cc && cc.trim()) headers.push(`Cc: ${cc}`)
  if (bcc && bcc.trim()) headers.push(`Bcc: ${bcc}`)
  headers.push(`Subject: ${subject}`, 'MIME-Version: 1.0')

  let message: string
  if (attachments && attachments.length > 0) {
    const boundary = `thb_${Math.abs(subject.length * 2654435761 % 2147483647)}_bnd`
    const parts: string[] = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      body,
    ]
    for (const a of attachments) {
      parts.push(
        `--${boundary}`,
        `Content-Type: ${a.contentType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        a.dataBase64.replace(/(.{76})/g, '$1\n')
      )
    }
    parts.push(`--${boundary}--`)
    message = parts.join('\n')
  } else {
    message = [...headers, 'Content-Type: text/html; charset=utf-8', '', body].join('\n')
  }

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

/** Raw HTML body (unsanitised) for the reader. */
function findPartByMime(payload: gmail_v1.Schema$MessagePart | undefined, mime: string): gmail_v1.Schema$MessagePart | undefined {
  if (!payload) return undefined
  if (payload.mimeType === mime && payload.body?.data) return payload
  for (const part of payload.parts ?? []) {
    const found = findPartByMime(part, mime)
    if (found) return found
  }
  return undefined
}

export function extractBodies(payload?: gmail_v1.Schema$MessagePart): { html: string | null; text: string | null } {
  const htmlPart = findPartByMime(payload, 'text/html')
  const textPart = findPartByMime(payload, 'text/plain')
  const html = htmlPart?.body?.data ? decodeBase64Url(htmlPart.body.data) : null
  const text = textPart?.body?.data
    ? decodeBase64Url(textPart.body.data).trim()
    : extractMessageBody(payload) || null
  return { html, text }
}

export function messageHasAttachments(payload?: gmail_v1.Schema$MessagePart): boolean {
  if (!payload) return false
  if (payload.filename && payload.filename.length > 0 && payload.body?.attachmentId) return true
  return (payload.parts ?? []).some((p) => messageHasAttachments(p))
}

/** List message ids matching a Gmail search query (e.g. "(in:inbox OR in:sent) newer_than:90d"). */
export async function listMessageIds(query: string, max = 300): Promise<string[]> {
  const gmail = await getGmailClient()
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100, pageToken })
    for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id)
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken && ids.length < max)
  return ids.slice(0, max)
}

export async function getFullMessage(id: string): Promise<gmail_v1.Schema$Message> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
  return res.data
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
