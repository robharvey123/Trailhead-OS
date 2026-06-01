import { createClient } from '@/lib/supabase/server'
import type { EmailLog, EmailThread, EmailMatchMethod } from '@/lib/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function getSupabase(client?: SupabaseClient) {
  return client ?? createClient()
}

export type InboxFolder = 'unread' | 'all' | 'starred' | 'unmatched' | 'sent'

const SELECT =
  'id, gmail_message_id, gmail_thread_id, account_id, contact_id, direction, from_address, from_name, to_addresses, cc_addresses, bcc_addresses, subject, snippet, body_html, body_text, is_unread, is_starred, labels, match_method, received_at, sent_at, created_at, account:accounts(id,name)'

type Row = EmailLog & { account?: { id: string; name: string } | null }

function tsOf(r: Row): string {
  return r.received_at || r.sent_at || r.created_at
}

export async function listThreads(
  opts: { folder?: InboxFolder; accountId?: string; search?: string } = {},
  client?: SupabaseClient
): Promise<EmailThread[]> {
  const supabase = await getSupabase(client)
  let query = supabase.from('email_logs').select(SELECT).order('created_at', { ascending: false }).limit(800)

  switch (opts.folder) {
    case 'unread': query = query.eq('is_unread', true); break
    case 'starred': query = query.eq('is_starred', true); break
    case 'unmatched': query = query.is('account_id', null); break
    case 'sent': query = query.eq('direction', 'outbound'); break
    default: break
  }
  if (opts.accountId) query = query.eq('account_id', opts.accountId)
  if (opts.search) query = query.ilike('subject', `%${opts.search}%`)

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
      match_method: (latest.match_method as EmailMatchMethod) ?? null,
      has_attachments: false,
      has_outbound: msgs.some((m) => m.direction === 'outbound'),
    })
  }
  threads.sort((a, b) => b.last_at.localeCompare(a.last_at))
  return threads
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

export async function setThreadRead(threadId: string, isUnread: boolean, client?: SupabaseClient): Promise<void> {
  const supabase = await getSupabase(client)
  const { error } = await supabase.from('email_logs').update({ is_unread: isUnread }).eq('gmail_thread_id', threadId)
  if (error) throw new Error(error.message || 'Failed to update thread')
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
