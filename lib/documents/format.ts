/**
 * Small display helpers for the engagement Documents section. Kept locale-pinned to
 * en-GB so a value formats identically on server and client (no hydration mismatch).
 */

/**
 * Format a date for the Documents UI. Handles BOTH date-only values (e.g. a
 * `week_start` `date` column → "2026-08-08") and full timestamps (e.g. a
 * `created_at` `timestamptz` → "2026-08-08T10:30:00+00:00"), and never renders
 * "Invalid Date": anything unparseable, null or undefined becomes an em dash.
 *
 * A date-only value is pinned to UTC midnight so the day doesn't shift under the
 * viewer's timezone; a full timestamp is parsed as-is. (The previous inline helper
 * appended "T00:00:00Z" to EVERYTHING, which corrupted full timestamps into
 * Invalid Date — that was the "Invalid Date on every row" bug.)
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(d)
}

/** Human-readable file size. Null/NaN → em dash. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1 }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * How a document should be previewed, from its mime type (with a filename fallback
 * for .docx, whose mime is easy to lose). 'docx' renders via server-side conversion;
 * everything not image/pdf/docx falls back to a download card.
 */
export function mimeKind(mime: string | null | undefined, fileName?: string | null): 'image' | 'pdf' | 'docx' | 'other' {
  if (mime?.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === DOCX_MIME || fileName?.toLowerCase().endsWith('.docx')) return 'docx'
  return 'other'
}

/** Short uppercase label for a document, from mime type then filename extension. */
export function mimeLabel(mime: string | null | undefined, fileName?: string | null): string {
  if (mime === 'application/pdf') return 'PDF'
  if (mime?.startsWith('image/')) return mime.slice('image/'.length).toUpperCase()
  const ext = fileName?.split('.').pop()
  if (ext && ext !== fileName) return ext.toUpperCase()
  if (mime && mime !== 'application/octet-stream') return mime
  return 'File'
}
