import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * OS routes authorise with the caller's own client (RLS) before handing over
 * to service-role helpers, so a session that cannot read a quote can never
 * publish, revoke, preview or download it.
 */
export async function canReadQuote(supabase: SupabaseClient, quoteId: string): Promise<boolean> {
  const { data } = await supabase.from('quotes').select('id').eq('id', quoteId).is('deleted_at', null).maybeSingle()
  return Boolean(data)
}
