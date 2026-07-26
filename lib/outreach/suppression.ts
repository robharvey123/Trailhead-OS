import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailSuppressionReason } from '@/lib/types'

/**
 * Is this address suppressed? Fails CLOSED — any query error counts as suppressed,
 * so we never send on uncertainty. Uses an exact lowercased `.eq` (not ILIKE, whose
 * `_`/`%` are legal in a local part and would false-match). Suppressions are stored
 * lowercased (see addSuppression), so the match is exact and case-insensitive.
 */
export async function isSuppressed(db: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await db
    .from('email_suppressions')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .limit(1)
  if (error) return true
  return (data?.length ?? 0) > 0
}

/** Insert a suppression (lowercased, idempotent against the lower(email) unique index). */
export async function addSuppression(
  db: SupabaseClient,
  email: string,
  reason: EmailSuppressionReason,
  source: string
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return
  await db.from('email_suppressions').insert({ email: normalized, reason, source }).then(() => {}, () => {})
}
