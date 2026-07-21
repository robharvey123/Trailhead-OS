import { google, type gmail_v1 } from 'googleapis'
import { randomUUID } from 'crypto'
import { convert as htmlToText } from 'html-to-text'
import type { EmailLog, EmailAttachmentMeta } from '@/lib/types'
import { getAuthenticatedClient } from './oauth'
import { stripDocumentWrappers } from '@/lib/email/strip-document'

export async function getGmailClient() {
  const auth = await getAuthenticatedClient()
  return google.gmail({ version: 'v1', auth })
}

/**
 * Compose an outbound email from an inner HTML fragment (typed body + signature):
 * wrap it in ONE clean HTML document and derive a readable plain-text alternative.
 */
export function composeOutboundEmail(inner: string): { html: string; text: string } {
  const cleanInner = stripDocumentWrappers(inner)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${cleanInner}</body></html>`
  const text = htmlToText(html, { wordwrap: 80 })
  return { html, text }
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

export interface OutboundMessage {
  to: string
  cc?: string
  bcc?: string
  subject: string
  body: string
  /** RFC822 Message-ID of the message being replied to (for In-Reply-To/References). */
  inReplyTo?: string
  references?: string
  attachments?: OutboundAttachment[]
}

/**
 * Build a base64url-encoded RFC822 message from an outbound payload. Shared by
 * the send path AND the drafts path so both produce identical MIME.
 */
export function buildRawMessage(opts: OutboundMessage): { raw: string; html: string; text: string } {
  // For replies, prefix "Re: " (if absent) and emit threading headers so the
  // message threads on the Gmail side AND in the recipient's mail client.
  const isReply = Boolean(opts.inReplyTo)
  const finalSubject = isReply && !/^re:\s/i.test(opts.subject) ? `Re: ${opts.subject}` : opts.subject

  const headers = [`To: ${opts.to}`]
  if (opts.cc && opts.cc.trim()) headers.push(`Cc: ${opts.cc}`)
  if (opts.bcc && opts.bcc.trim()) headers.push(`Bcc: ${opts.bcc}`)
  headers.push(`Subject: ${finalSubject}`, 'MIME-Version: 1.0')
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`)
  if (opts.references) headers.push(`References: ${opts.references}`)

  // Single clean HTML document + plain-text alternative.
  const { html, text } = composeOutboundEmail(opts.body)

  // text/plain + text/html as a multipart/alternative block (clients pick HTML,
  // spam filters + accessibility get the text version).
  const altBoundary = `alt_${randomUUID()}`
  const altBlock = [
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    text,
    `--${altBoundary}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
    `--${altBoundary}--`,
  ]

  let message: string
  const attachments = opts.attachments
  if (attachments && attachments.length > 0) {
    // multipart/mixed [ multipart/alternative, ...attachments ]
    const mixed = `mix_${randomUUID()}`
    const parts: string[] = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${mixed}"`,
      '',
      `--${mixed}`,
      ...altBlock,
    ]
    for (const a of attachments) {
      parts.push(
        `--${mixed}`,
        `Content-Type: ${a.contentType}; name="${a.filename}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${a.filename}"`,
        '',
        a.dataBase64.replace(/(.{76})/g, '$1\n')
      )
    }
    parts.push(`--${mixed}--`)
    message = parts.join('\n')
  } else {
    message = [...headers, ...altBlock].join('\n')
  }

  const raw = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return { raw, html, text }
}

export async function sendEmail(opts: OutboundMessage & { replyToMessageId?: string }) {
  const gmail = await getGmailClient()
  const { raw, html, text } = buildRawMessage(opts)
  const requestBody: { raw: string; threadId?: string } = { raw }
  if (opts.replyToMessageId) requestBody.threadId = opts.replyToMessageId
  const res = await gmail.users.messages.send({ userId: 'me', requestBody })
  // Return the composed html/text too so callers can store the clean versions.
  return { data: res.data, html, text }
}

// --- Drafts (Gmail's own drafts API, so they sync everywhere) ---------------

export interface DraftSummary {
  id: string
  message_id?: string
  thread_id?: string
  to: string
  subject: string
  snippet: string
}

/** Create a Gmail draft from an outbound payload; returns the draft id. */
export async function createDraft(opts: OutboundMessage & { threadId?: string }): Promise<{ id: string; thread_id?: string }> {
  const gmail = await getGmailClient()
  const { raw } = buildRawMessage(opts)
  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw, threadId: opts.threadId } },
  })
  return { id: res.data.id!, thread_id: res.data.message?.threadId ?? undefined }
}

export async function updateDraft(draftId: string, opts: OutboundMessage & { threadId?: string }): Promise<void> {
  const gmail = await getGmailClient()
  const { raw } = buildRawMessage(opts)
  await gmail.users.drafts.update({
    userId: 'me',
    id: draftId,
    requestBody: { message: { raw, threadId: opts.threadId } },
  })
}

export async function deleteDraft(draftId: string): Promise<void> {
  const gmail = await getGmailClient()
  await gmail.users.drafts.delete({ userId: 'me', id: draftId })
}

/** Send an existing draft — Gmail removes the draft itself once it's sent. */
export async function sendDraft(draftId: string): Promise<gmail_v1.Schema$Message> {
  const gmail = await getGmailClient()
  const res = await gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } })
  return res.data
}

export async function listDrafts(): Promise<DraftSummary[]> {
  const gmail = await getGmailClient()
  const { data } = await gmail.users.drafts.list({ userId: 'me', maxResults: 50 })
  const drafts = data.drafts ?? []
  return Promise.all(
    drafts.map(async (d) => {
      const full = await gmail.users.drafts.get({ userId: 'me', id: d.id!, format: 'metadata' })
      const msg = full.data.message
      const headers = msg?.payload?.headers ?? []
      const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
      return {
        id: d.id!,
        message_id: msg?.id ?? undefined,
        thread_id: msg?.threadId ?? undefined,
        to: h('To'),
        subject: h('Subject'),
        snippet: msg?.snippet ?? '',
      }
    })
  )
}

/** Full draft content for editing (to/cc/subject/body). */
export async function getDraft(draftId: string): Promise<{
  id: string
  thread_id?: string
  to: string[]
  cc: string[]
  subject: string
  body_html: string | null
  body_text: string | null
}> {
  const gmail = await getGmailClient()
  const { data } = await gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'full' })
  const msg = data.message
  const headers = msg?.payload?.headers ?? []
  const h = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ''
  const splitAddrs = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const { html, text } = extractBodies(msg?.payload)
  return {
    id: draftId,
    thread_id: msg?.threadId ?? undefined,
    to: splitAddrs(h('To')),
    cc: splitAddrs(h('Cc')),
    subject: h('Subject'),
    body_html: html,
    body_text: text,
  }
}

/** Search the whole mailbox by Gmail query; returns {id, threadId} refs (max). */
export async function searchMessageRefs(query: string, max = 50): Promise<Array<{ id: string; threadId: string }>> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: max })
  const out: Array<{ id: string; threadId: string }> = []
  for (const m of res.data.messages ?? []) if (m.id && m.threadId) out.push({ id: m.id, threadId: m.threadId })
  return out
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

/** Recursively collect attachment metadata (parts with a filename + attachmentId). */
export function collectAttachments(payload?: gmail_v1.Schema$MessagePart): EmailAttachmentMeta[] {
  const out: EmailAttachmentMeta[] = []
  function walk(part?: gmail_v1.Schema$MessagePart) {
    if (!part) return
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      out.push({
        filename: part.filename,
        mime_type: part.mimeType ?? 'application/octet-stream',
        attachment_id: part.body.attachmentId,
        size_bytes: part.body.size ?? 0,
      })
    }
    for (const p of part.parts ?? []) walk(p)
  }
  walk(payload)
  return out
}

/** Fetch a single attachment's raw bytes (base64url-decoded) for streaming back. */
export async function getAttachmentBytes(messageId: string, attachmentId: string): Promise<Buffer> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId })
  const data = res.data.data ?? ''
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized, 'base64')
}

/** Add/remove Gmail labels on a whole thread (e.g. archive = remove INBOX). */
export async function modifyThread(
  threadId: string,
  mods: { addLabelIds?: string[]; removeLabelIds?: string[] }
): Promise<void> {
  const gmail = await getGmailClient()
  await gmail.users.threads.modify({
    userId: 'me',
    id: threadId,
    requestBody: { addLabelIds: mods.addLabelIds ?? [], removeLabelIds: mods.removeLabelIds ?? [] },
  })
}

/**
 * Threading headers for a reply into an existing Gmail thread: the RFC822
 * Message-ID of the thread's most recent message, plus a References chain.
 * Returns {} if it can't be resolved (caller falls back to threadId-only).
 */
export async function getThreadReplyHeaders(threadId: string): Promise<{ inReplyTo?: string; references?: string }> {
  const gmail = await getGmailClient()
  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'metadata',
    metadataHeaders: ['Message-ID', 'References'],
  })
  const messages = data.messages ?? []
  const last = messages[messages.length - 1]
  const headers = last?.payload?.headers ?? []
  const header = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
  const messageId = header('Message-ID')
  if (!messageId) return {}
  const priorRefs = header('References')
  return { inReplyTo: messageId, references: [priorRefs, messageId].filter(Boolean).join(' ') }
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

/**
 * Metadata-only fetch of a message's current Gmail labels (UNREAD/STARRED/INBOX…).
 * Cheap relative to a full fetch — used to refresh read/archive state on messages
 * already ingested into email_logs.
 */
export async function getMessageLabels(id: string): Promise<string[]> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'metadata',
    metadataHeaders: [],
  })
  return res.data.labelIds ?? []
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
