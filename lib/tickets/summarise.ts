/**
 * Derive a short, plain-text summary from a ticket (an engagement task).
 *
 * Strips HTML and common markdown, collapses whitespace, and truncates to
 * ~120 characters. Used to pre-fill a timesheet entry's description when a
 * timer is started on a task that was instigated by a ticket.
 */
export function summariseTicket(ticket: { title?: string | null; body?: string | null }): string {
  const source = (ticket.title?.trim() || ticket.body?.trim() || '').toString()
  const stripped = source
    .replace(/<[^>]+>/g, ' ') // strip HTML
    .replace(/[#*_>`~\[\]\(\)]/g, ' ') // strip common markdown
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim()
  return stripped.length > 120 ? stripped.slice(0, 117).trimEnd() + '…' : stripped
}
