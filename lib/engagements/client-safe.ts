/**
 * Client-safe projection layer for engagement reports (Stage A).
 *
 * Everything a client can see — PDF, XLSX, email — must pass through here first.
 * The rule is WHITELIST, never blacklist: a projection returns a fixed, explicit
 * shape, so a new column added to a source table can never silently appear in a
 * client artefact. If a field isn't listed in a ClientSafe* type below, it does
 * not reach the client. Full stop.
 *
 * Never projected: rate_snapshot / any rate, value, cost or margin; time-entry
 * notes; prompt guidelines; Annex A / workstream labels and raw `labels`;
 * internal task/entry descriptions (see description sanitisation below);
 * contributor identities and rates; is_billable.
 */

/** Field/column names that must never appear, serialised, in any client artefact. */
export const EXCLUDED_FIELD_NAMES: readonly string[] = [
  'rate_snapshot',
  'rate',
  'value',
  'cost',
  'margin',
  'notes',
  'is_billable',
  'billable',
  'prompt_guideline',
  'prompt_guidelines',
  'labels',
  'day_rate',
  'retainer_amount_monthly',
]

/** Currency symbols that must never appear in a client artefact's rendered text. */
export const CURRENCY_SYMBOLS: readonly string[] = ['£', '$', '€', '¥', '₹']

/**
 * When a client_description is absent, fall back to the internal description ONLY
 * if this is explicitly enabled. It defaults to false so an unwritten client
 * description renders as a generic line rather than leaking internal phrasing.
 */
export const REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION =
  process.env.REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION === 'true'

/**
 * Generic line shown when a work item has no client_description and fallback is
 * off. Deliberately neutral — it should read as an intentional summary, not a
 * placeholder. NOTE (Stage A): confirm final wording with Rob before go-live.
 */
export const GENERIC_DESCRIPTION_FALLBACK = 'Delivered as part of the engagement.'

export type ClientSafeTimeEntry = {
  entry_date: string
  description: string // sanitised
  hours: number // 2dp
}

export type ClientSafeTask = {
  title: string
  description: string | null // sanitised
  due_date: string | null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Resolve a client-facing description. Prefers an explicit client_description;
 * otherwise the generic line, or the internal description only when the flag is
 * on. Whitespace is collapsed; content is never otherwise altered.
 */
export function sanitiseDescription(
  clientDescription: string | null | undefined,
  internalDescription: string | null | undefined
): string {
  const client = clientDescription?.trim()
  if (client) return client.replace(/\s+/g, ' ')
  if (REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION) {
    const internal = internalDescription?.trim()
    if (internal) return internal.replace(/\s+/g, ' ')
  }
  return GENERIC_DESCRIPTION_FALLBACK
}

/** Project a time entry to the only three fields a client may see. */
export function toClientSafeTimeEntry(row: {
  entry_date: string
  hours?: number | null
  duration_minutes?: number | null
  description?: string | null
  client_description?: string | null
}): ClientSafeTimeEntry {
  const hours = row.hours != null ? row.hours : round2((row.duration_minutes ?? 0) / 60)
  return {
    entry_date: row.entry_date,
    description: sanitiseDescription(row.client_description, row.description),
    hours: round2(hours),
  }
}

/** Project a task to the only fields a client may see. A task with no client-safe
 * description shows the generic line rather than its internal execution notes. */
export function toClientSafeTask(row: {
  title: string
  description?: string | null
  client_description?: string | null
  due_date?: string | null
}): ClientSafeTask {
  const desc = sanitiseDescription(row.client_description, row.description)
  return {
    title: row.title,
    description: desc || null,
    due_date: row.due_date ?? null,
  }
}
