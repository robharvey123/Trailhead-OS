import { createClient } from '@/lib/supabase/server'
import { modifyThread } from '@/lib/google/gmail'
import type { EmailLog, EmailThread, EmailMatchMethod } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export type InboxFolder = 'inbox' | 'unread' | 'all' | 'starred' | 'unmatched' | 'sent' | 'archived'

const SELECT =
  'id, gmail_message_id, gmail_thread_id, account_id, contact_id, direction, from_address, from_name, to_addresses, cc_addresses, bcc_addresses, subject, snippet, body_html, body_text, is_unread, is_starred, labels, match_method, received_at, sent_at, created_at, account:accounts(id,name)'

type Row = EmailLog & { account?: { id: string; name: string } | null }

function tsOf(r: Row): string {
  return r.received_at || r.sent_at || r.created_at
}

export async function listThreads(
  opts: { folder?: InboxFolder; accountId?: string; contactId?: string; search?: string } = {},
  client?: SupabaseClient
): Promise<EmailThread[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('email_logs').select(SELECT).order('created_at', { ascending: false }).limit(800)

  // SQL pre-filter only for non-label folders. inbox/archived/unread/sent depend
  // on per-thread state, so they're filtered after grouping (below). In
  // particular 'sent' means "the thread has an outbound message" (has_outbound),
  // not "this row is outbound" — so it must be a post-group filter to match the
  // client-side definition.
  switch (opts.folder) {
    case 'starred': query = query.eq('is_starred', true); break
    case 'unmatched': query = query.is('account_id', null); break
    default: break
  }
  if (opts.accountId) query = query.eq('account_id', opts.accountId)
  if (opts.contactId) query = query.eq('contact_id', opts.contactId)
  if (opts.search) {
    // Match across the headline text columns. Sanitise chars that would break
    // PostgREST's or() grammar (commas/parens); body_text is intentionally
    // excluded — too heavy for ilike (full-body search is a later brief).
    const s = opts.search.replace(/[,()]/g, ' ').trim()
    if (s) {
      query = query.or(
        `subject.ilike.%${s}%,from_name.ilike.%${s}%,from_address.ilike.%${s}%,snippet.ilike.%${s}%`
      )
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load threads')
  const rows = (data ?? []) as unknown as Row[]

  const byThread = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r.gmail_thread_id || r.id
    ;(byThread.get(key) ?? byThread.set(key, []).get(key)!).push(r)
  }

  const threads: EmailThread[] = []
  for (const [key, msgs] of byThread) {
    msgs.sort((a, b) => tsOf(b).localeCompare(tsOf(a)))
    const latest = msgs[0]
    const account = msgs.find((m) => m.account)?.account ?? null
    // A thread is "in inbox" if any of its messages still carries the INBOX label.
    const inInbox = msgs.some((m) => (m.labels ?? []).includes('INBOX'))
    threads.push({
      gmail_thread_id: key,
      account_id: account?.id ?? latest.account_id ?? null,
      account_name: account?.name ?? null,
      subject: latest.subject || '(no subject)',
      snippet: latest.snippet || '',
      from_name: latest.from_name || latest.from_address,
      from_address: latest.from_address,
      last_at: tsOf(latest),
      message_count: msgs.length,
      is_unread: msgs.some((m) => m.is_unread),
      is_starred: msgs.some((m) => m.is_starred),
      in_inbox: inInbox,
      match_method: (latest.match_method as EmailMatchMethod) ?? null,
      has_attachments: false,
      has_outbound: msgs.some((m) => m.direction === 'outbound'),
    })
  }

  // Per-thread label folders.
  let result = threads
  if (opts.folder === 'inbox') result = result.filter((t) => t.in_inbox)
  else if (opts.folder === 'archived') result = result.filter((t) => !t.in_inbox)
  else if (opts.folder === 'unread') result = result.filter((t) => t.is_unread && t.in_inbox)
  else if (opts.folder === 'sent') result = result.filter((t) => t.has_outbound)

  result.sort((a, b) => b.last_at.localeCompare(a.last_at))
  return result
}

export async function getThreadMessages(threadId: string, client?: SupabaseClient): Promise<Row[]> {
  const supabase = await getSupabase(client)
  const { data, error } = await supabase
    .from('email_logs')
    .select(SELECT)
    .eq('gmail_thread_id', threadId)
  if (error) throw new Error(error.message || 'Failed to load thread')
  const rows = (data ?? []) as unknown as Row[]
  return rows.sort((a, b) => tsOf(a).localeCompare(tsOf(b)))
}

/**
 * Apply label add/remove to every message in a thread locally, optionally also
 * setting a column (e.g. is_unread). Kept in sync with Gmail by callers. Reads
 * each row's labels and rewrites — avoids duplicate labels and needs no RPC.
 */
async function applyThreadLabels(
  threadId: string,
  mods: { add?: string[]; remove?: string[] },
  extra: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<void> {
  const { data: rows } = await supabase.from('email_logs').select('id, labels').eq('gmail_thread_id', threadId)
  for (const r of (rows ?? []) as Array<{ id: string; labels: string[] | null }>) {
    let labels = (r.labels ?? []).filter((l) => !(mods.remove ?? []).includes(l))
    for (const a of mods.add ?? []) if (!labels.includes(a)) labels = [...labels, a]
    const { error } = await supabase.from('email_logs').update({ labels, ...extra }).eq('id', r.id)
    if (error) throw new Error(error.message || 'Failed to update thread labels')
  }
}

export async function setThreadRead(threadId: string, isUnread: boolean, client?: SupabaseClient): Promise<void> {
  // Gmail first — if it fails we don't lie to the user by updating local state.
  await modifyThread(threadId, isUnread ? { addLabelIds: ['UNREAD'] } : { removeLabelIds: ['UNREAD'] })
  const supabase = await getSupabase(client)
  await applyThreadLabels(threadId, isUnread ? { add: ['UNREAD'] } : { remove: ['UNREAD'] }, { is_unread: isUnread }, supabase)
}

export async function archiveThread(threadId: string, client?: SupabaseClient): Promise<void> {
  await modifyThread(threadId, { removeLabelIds: ['INBOX'] })
  const supabase = await getSupabase(client)
  await applyThreadLabels(threadId, { remove: ['INBOX'] }, {}, supabase)
}

export async function unarchiveThread(threadId: string, client?: SupabaseClient): Promise<void> {
  await modifyThread(threadId, { addLabelIds: ['INBOX'] })
  const supabase = await getSupabase(client)
  await applyThreadLabels(threadId, { add: ['INBOX'] }, {}, supabase)
}

export async function setThreadStarred(threadId: string, isStarred: boolean, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('email_logs').update({ is_starred: isStarred }).eq('gmail_thread_id', threadId)
  if (error) throw new Error(error.message || 'Failed to star thread')
}

export async function linkThread(threadId: string, accountId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('email_logs')
    .update({ account_id: accountId, match_method: 'manual' })
    .eq('gmail_thread_id', threadId)
  if (error) throw new Error(error.message || 'Failed to link thread')
}

export async function unlinkThread(threadId: string, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase
    .from('email_logs')
    .update({ account_id: null, match_method: 'unmatched' })
    .eq('gmail_thread_id', threadId)
  if (error) throw new Error(error.message || 'Failed to unlink thread')
}
