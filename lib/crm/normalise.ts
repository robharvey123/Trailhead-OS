// Normalised company name for fuzzy account matching.
//
// SINGLE SOURCE OF TRUTH IS THE SQL. This is a byte-identical mirror of
// crm_normalise_name() in supabase/migrations/20260729100000_contact_account_link.sql.
// If you change one, change the other or the client will offer to create something
// the server considers a duplicate. (Postgres \y word-boundary == JS \b.)

const SUFFIX_RE = /\b(ltd|limited|llp|plc|inc|incorporated|srl|aps|ab|gmbh|bv|co|company|group|holdings|uk)\b/g

export function crmNormaliseName(input: string | null | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .replace(SUFFIX_RE, '')
    .replace(/[^a-z0-9]/g, '')
}
