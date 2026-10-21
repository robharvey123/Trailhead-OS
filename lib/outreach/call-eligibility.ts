import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The one call-eligibility rule (view contact_call_eligibility, migration
 * 20261022110000). A contact may be phoned only when CTPS was screened within
 * 28 days and is clear, it is not do_not_call, not unsubscribed, not bounced,
 * and it has a phone. Every call queue asks this helper; nothing else should
 * read ctps_* to decide who to call.
 */
export type CallEligibilityReason =
  | 'eligible'
  | 'do_not_call'
  | 'unsubscribed'
  | 'bounced'
  | 'ctps_registered'
  | 'unscreened'
  | 'ctps_stale'
  | 'no_phone'

export interface CallEligibility {
  contact_id: string
  eligible: boolean
  reason: CallEligibilityReason
  ctps_checked_at: string | null
  ctps_valid_until: string | null
}

/** Reasons that mean "screen (or re-screen) this number", as opposed to "never call". */
export const NEEDS_SCREENING: ReadonlySet<CallEligibilityReason> = new Set(['unscreened', 'ctps_stale'])

const CHUNK = 200

/** Eligibility for the given contacts, keyed by contact id. Unknown ids are absent. */
export async function getCallEligibility(
  supabase: SupabaseClient,
  contactIds: readonly string[],
): Promise<Map<string, CallEligibility>> {
  const ids = Array.from(new Set(contactIds))
  const out = new Map<string, CallEligibility>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('contact_call_eligibility')
      .select('contact_id, eligible, reason, ctps_checked_at, ctps_valid_until')
      .in('contact_id', ids.slice(i, i + CHUNK))
    // Fail closed: if eligibility can't be read, nobody is callable.
    if (error) throw new Error(`call eligibility unavailable: ${error.message}`)
    for (const row of (data ?? []) as CallEligibility[]) out.set(row.contact_id, row)
  }
  return out
}
