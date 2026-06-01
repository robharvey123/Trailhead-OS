import { createClient } from '@/lib/supabase/service'
import { getAllGoogleTokens } from './oauth'
import { listMessageIds, getFullMessage, extractBodies } from './gmail'
import { buildAutolinkMaps, determineLink, parseAddress, parseAddressList } from './autolink'

export interface SyncResult {
  scanned: number
  inserted: number
  skipped: number
}

/**
 * Poll Gmail INBOX + SENT and ingest messages into email_logs.
 * Idempotent: messages already present (by gmail_message_id) are skipped.
 * Runs with the service-role client (used by both the on-demand button and the cron).
 */
export async function syncMailbox({ sinceDays = 7, max = 300 }: { sinceDays?: number; max?: number } = {}): Promise<SyncResult> {
  const supabase = createClient()

  // Self identity (the connected Workspace mailbox).
  const tokens = await getAllGoogleTokens()
  const selfEmails = tokens.map((t) => t.email).filter(Boolean) as string[]

  // Build the auto-link lookup once.
  const [{ data: contacts }, { data: accounts }] = await Promise.all([
    supabase.from('contacts').select('id, email, account_id'),
    supabase.from('accounts').select('id, website, email_contact'),
  ])
  const maps = buildAutolinkMaps(contacts ?? [], accounts ?? [], selfEmails)

  // Which messages do we already have?
  const ids = await listMessageIds(`(in:inbox OR in:sent) newer_than:${sinceDays}d`, max)
  const { data: existingRows } = await supabase
    .from('email_logs')
    .select('gmail_message_id')
    .in('gmail_message_id', ids.length ? ids : ['__none__'])
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id))

  const toFetch = ids.filter((id) => !existing.has(id))
  let inserted = 0

  for (const id of toFetch) {
    try {
      const msg = await getFullMessage(id)
      const headers = msg.payload?.headers ?? []
      const header = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

      const from = parseAddress(header('From'))
      const to = parseAddressList(header('To'))
      const cc = parseAddressList(header('Cc'))
      const bcc = parseAddressList(header('Bcc'))
      const labels = msg.labelIds ?? []
      const direction = labels.includes('SENT') ? 'outbound' : 'inbound'
      const { html, text } = extractBodies(msg.payload)
      const ts = msg.internalDate ? new Date(Number.parseInt(msg.internalDate, 10)).toISOString() : null

      const participants = [from.email, ...to, ...cc].filter(Boolean)
      const link = determineLink(participants, maps)

      const { error } = await supabase.from('email_logs').insert({
        gmail_message_id: id,
        gmail_thread_id: msg.threadId ?? null,
        account_id: link.account_id,
        contact_id: link.contact_id,
        match_method: link.method,
        direction,
        from_address: from.email,
        from_name: from.name,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        subject: header('Subject'),
        snippet: msg.snippet?.slice(0, 280) ?? null,
        body_html: html,
        body_text: text,
        is_unread: labels.includes('UNREAD'),
        is_starred: labels.includes('STARRED'),
        labels,
        received_at: direction === 'inbound' ? ts : null,
        sent_at: direction === 'outbound' ? ts : null,
      })
      if (!error) inserted++
    } catch {
      // skip individual message failures; continue the batch
    }
  }

  return { scanned: ids.length, inserted, skipped: ids.length - toFetch.length }
}
