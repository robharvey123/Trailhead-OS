import { createHash } from 'crypto'
import { normaliseParticipantName } from './normalise'
import { isoToMinute } from './time'

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Stable ID for an imported message. Exports carry no message ID, so re-importing
 * the same chat must produce the same IDs and upsert cleanly. Scoped to the
 * conversation so a second import of the same file lands on the same rows.
 */
export function importMessageId(conversationId: string, occurredAtUtc: string, sender: string | null, body: string): string {
  const key = `${conversationId}|${occurredAtUtc}|${sender ? normaliseParticipantName(sender) : ''}|${body}`
  return `import_${sha256(key).slice(0, 40)}`
}

/**
 * Live-capture ID: conversation + minute + sender + body. Cowork will re-log the
 * same message when a conversation is revisited; the unique violation is how
 * that becomes a 200 { deduped: true } instead of a duplicate row.
 */
export function captureMessageId(conversationId: string, occurredAtUtc: string, sender: string, body: string): string {
  const key = `${conversationId}|${isoToMinute(occurredAtUtc)}|${normaliseParticipantName(sender)}|${body}`
  return `cw:${sha256(key)}`
}
