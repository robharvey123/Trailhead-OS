import type { SupabaseClient } from '@supabase/supabase-js'
import { addSuppression } from './suppression'

/**
 * Suppress the address, flag the contact do_not_email, and stop the sequence.
 * Idempotent; safe to call for an unknown token (no-op). Only ever invoked from a
 * genuine user action (confirm-page POST or RFC 8058 one-click POST) — never a GET,
 * so mail-scanner prefetches can't unsubscribe prospects.
 */
export async function applyUnsubscribe(db: SupabaseClient, token: string): Promise<void> {
  const { data: recipient } = await db
    .from('outreach_recipients')
    .select('id, contact_id')
    .eq('unsubscribe_token', token)
    .maybeSingle<{ id: string; contact_id: string }>()
  if (!recipient) return

  const { data: contact } = await db.from('contacts').select('email').eq('id', recipient.contact_id).maybeSingle<{ email: string | null }>()
  if (contact?.email) {
    await addSuppression(db, contact.email, 'unsubscribed', 'unsubscribe-link')
    await db.from('contacts').update({ do_not_email: true }).eq('id', recipient.contact_id)
  }
  await db.from('outreach_recipients').update({ status: 'stopped', stopped_reason: 'unsubscribed', stopped_at: new Date().toISOString() }).eq('id', recipient.id)
}
