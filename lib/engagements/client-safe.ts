/**
 * Client-safe projection layer for engagement reports (Stage A + amendments).
 *
 * Everything a client can see — PDF, XLSX, email, spine — passes through here.
 * The rule is WHITELIST, never blacklist: a projection returns a fixed, explicit
 * shape, so a new column can never silently reach a client artefact. If a field
 * isn't in a ClientSafe* type, it does not reach the client.
 *
 * Descriptions are fail-closed. A time entry resolves its client description
 * through a chain and REFUSES rather than inventing one; a refused entry is
 * surfaced as "unattributed" by the caller, never rendered with a fabricated line.
 *
 * Never projected: rate_snapshot / any rate, value, cost or margin; time-entry
 * notes; prompt guidelines; Annex A / workstream labels and raw `labels`;
 * internal task/entry descriptions (unless the fallback flag is on); contributor
 * identities and rates; is_billable.
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
 * Opt-in only: allow internal descriptions into the fallback chain (before it
 * refuses). Defaults false so an unwritten client description never leaks
 * internal phrasing.
 */
export const REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION =
  process.env.REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION === 'true'

/** Honest label for a time entry that could not be attributed to a client-safe
 * description (no linked task). Not a fabricated description. */
export const UNATTRIBUTED_LABEL = '(unattributed time)'

export type ClientSafeTimeEntry = {
  entry_date: string
  description: string // resolved via the chain, or UNATTRIBUTED_LABEL
  hours: number // 2dp
}

export type ClientSafeTask = {
  title: string
  description: string | null // client_description only (never the internal one, unless flagged)
  due_date: string | null
}

function clean(s: string | null | undefined): string {
  return (s ?? '').trim().replace(/\s+/g, ' ')
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type TimeEntryDescriptionParts = {
  entry_client_description?: string | null
  task_client_description?: string | null
  task_title?: string | null
  // Only consulted when REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION is true:
  entry_description?: string | null
  task_description?: string | null
}

/**
 * Resolve a time entry's client-facing description, or return null to REFUSE.
 * Chain: entry.client_description → linked task.client_description →
 * linked task.title → (internal text, only if the flag is on) → refuse.
 */
export function resolveTimeEntryDescription(p: TimeEntryDescriptionParts): string | null {
  const chain = [p.entry_client_description, p.task_client_description, p.task_title]
  if (REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION) chain.push(p.entry_description, p.task_description)
  for (const candidate of chain) {
    const c = clean(candidate)
    if (c) return c
  }
  return null
}

/** True when the entry can be given a client-safe description without refusing. */
export function isAttributed(p: TimeEntryDescriptionParts): boolean {
  return resolveTimeEntryDescription(p) !== null
}

/** Project a time entry to the only three fields a client may see. A refused
 * (unattributed) entry gets the honest UNATTRIBUTED_LABEL, not a fabricated line. */
export function toClientSafeTimeEntry(row: {
  entry_date: string
  hours?: number | null
  duration_minutes?: number | null
} & TimeEntryDescriptionParts): ClientSafeTimeEntry {
  const hours = row.hours != null ? row.hours : round2((row.duration_minutes ?? 0) / 60)
  return {
    entry_date: row.entry_date,
    description: resolveTimeEntryDescription(row) ?? UNATTRIBUTED_LABEL,
    hours: round2(hours),
  }
}

/**
 * Project a task. Its title is always shown; the description is the client
 * description only (or the internal one when the flag is on), else null — never a
 * fabricated generic line.
 */
export function toClientSafeTask(row: {
  title: string
  description?: string | null
  client_description?: string | null
  due_date?: string | null
}): ClientSafeTask {
  const client = clean(row.client_description)
  const internal = REPORTS_FALLBACK_TO_INTERNAL_DESCRIPTION ? clean(row.description) : ''
  const desc = client || internal
  return {
    title: row.title,
    description: desc || null,
    due_date: row.due_date ?? null,
  }
}
