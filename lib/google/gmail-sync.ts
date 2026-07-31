import { createClient } from '@/lib/supabase/service'
import { getAllGoogleTokens, isInvalidGrant, markTokenNeedsReconnect } from './oauth'
import { listMessageIds, getFullMessage, getMessageLabels, extractBodies, collectAttachments } from './gmail'
import { buildAutolinkMaps, determineLink, parseAddress, parseAddressList } from './autolink'
import { applyInboundApprovalReplies } from '@/lib/db/approvals'
import { dispatchNewMailPush, type NewMailPushItem } from '@/lib/push/email'

export interface SyncResult {
  scanned: number
  inserted: number
  skipped: number
  /** Already-ingested messages whose read/star/label state was refreshed this run. */
  updated: number
  /** Set when the Google account's refresh token is dead — sync did nothing; reconnect needed. */
  reconnectRequired?: boolean
}

/** Order-insensitive equality for a message's label array. */
function labelsEqual(a: string[] | null | undefined, b: string[]): boolean {
  const left = [...(a ?? [])].sort()
  const right = [...b].sort()
  if (left.length !== right.length) return false
  return left.every((v, i) => v === right[i])
}

/**
 * Poll Gmail INBOX + SENT and ingest messages into email_logs.
 * Idempotent: messages already present (by gmail_message_id) are skipped.
 * Runs with the service-role client (used by both the on-demand button and the cron).
 */
export async function syncMailbox({
  sinceDays = 7,
  max = 300,
  notify = false,
  refreshLabels = true,
}: { sinceDays?: number; max?: number; notify?: boolean; refreshLabels?: boolean } = {}): Promise<SyncResult> {
  const supabase = createClient()

  // Self identity (the connected Workspace mailbox).
  const tokens = await getAllGoogleTokens()
  const selfEmails = tokens.map((t) => t.email).filter(Boolean) as string[]

  // Build the auto-link lookup once.
  const [{ data: contacts }, { data: accounts }] = await Promise.all([
    // Archived contacts (e.g. merge losers, retired duplicates) must not capture
    // mail — a live email should attach to the contact still in use.
    supabase.from('contacts').select('id, email, account_id').neq('status', 'archived'),
    supabase.from('accounts').select('id, website, email_contact'),
  ])
  const maps = buildAutolinkMaps(contacts ?? [], accounts ?? [], selfEmails)

  // Which messages do we already have? This is the first Gmail call, so a dead
  // refresh token surfaces here as invalid_grant — flag the account (the newest
  // token, which getAuthenticatedClient uses) and bail cleanly instead of 500ing.
  // Query the whole mailbox within the window (not just in:inbox OR in:sent), so a
  // message archived in Gmail still appears here and gets its INBOX label cleared by
  // the refresh below. Direction is detected from the SENT label, not the query.
  let ids: string[]
  try {
    ids = await listMessageIds(`newer_than:${sinceDays}d -in:spam -in:trash`, max)
  } catch (err) {
    if (isInvalidGrant(err)) {
      const newest = tokens[tokens.length - 1]
      if (newest) await markTokenNeedsReconnect(newest.id)
      return { scanned: 0, inserted: 0, skipped: 0, updated: 0, reconnectRequired: true }
    }
    throw err
  }
  const { data: existingRows } = await supabase
    .from('email_logs')
    .select('gmail_message_id')
    .in('gmail_message_id', ids.length ? ids : ['__none__'])
  const existing = new Set((existingRows ?? []).map((r) => r.gmail_message_id))

  const toFetch = ids.filter((id) => !existing.has(id))
  let inserted = 0
  const inboundReplies: Array<{ gmail_thread_id: string; body_text: string | null }> = []
  const newInbound: NewMailPushItem[] = []

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
      const attachments = collectAttachments(msg.payload)
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
        attachments,
        received_at: direction === 'inbound' ? ts : null,
        sent_at: direction === 'outbound' ? ts : null,
      })
      if (!error) {
        inserted++
        if (direction === 'inbound') {
          newInbound.push({ from_name: from.name, from_address: from.email, subject: header('Subject') })
        }
      }
      if (direction === 'inbound' && msg.threadId) inboundReplies.push({ gmail_thread_id: msg.threadId, body_text: text })
    } catch {
      // skip individual message failures; continue the batch
    }
  }

  // Refresh read/star/label state on messages we already have. Without this the
  // sync is insert-only and mail read/archived in Gmail stays unread/in-inbox here.
  // Bounded by the window (≤ max), newest-first, sequential; failures skip.
  let updated = 0
  if (refreshLabels) {
    const refreshIds = ids.filter((id) => existing.has(id))
    if (refreshIds.length > 0) {
      // One query for the batch's current stored state.
      const { data: currentRows } = await supabase
        .from('email_logs')
        .select('gmail_message_id, is_unread, is_starred, labels')
        .in('gmail_message_id', refreshIds)
      const current = new Map(
        (currentRows ?? []).map((r) => [
          r.gmail_message_id as string,
          { is_unread: r.is_unread as boolean, is_starred: r.is_starred as boolean, labels: (r.labels as string[] | null) ?? [] },
        ])
      )

      for (const id of refreshIds) {
        const cur = current.get(id)
        if (!cur) continue
        try {
          const labelIds = await getMessageLabels(id)
          const nextUnread = labelIds.includes('UNREAD')
          const nextStarred = labelIds.includes('STARRED')
          const changed =
            cur.is_unread !== nextUnread ||
            cur.is_starred !== nextStarred ||
            !labelsEqual(cur.labels, labelIds)
          if (!changed) continue

          const { error } = await supabase
            .from('email_logs')
            .update({ is_unread: nextUnread, is_starred: nextStarred, labels: labelIds })
            .eq('gmail_message_id', id)
          if (!error) updated++
        } catch {
          // skip individual failures; continue the batch
        }
      }
    }
  }

  // Flip any Open approval requests whose linked thread got an approve/decline reply.
  if (inboundReplies.length > 0) {
    try { await applyInboundApprovalReplies(inboundReplies, supabase) } catch { /* non-fatal */ }
  }

  // Push a "new email" notification (cron path only — the on-demand button/backfill
  // pass notify:false so a 90-day backfill doesn't fire hundreds of alerts).
  if (notify && newInbound.length > 0) {
    try { await dispatchNewMailPush(newInbound) } catch { /* non-fatal */ }
  }

  return { scanned: ids.length, inserted, updated, skipped: ids.length - toFetch.length }
}
