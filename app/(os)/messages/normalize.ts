import type { ChatMention } from './actions'

type RawMentionRow = {
  mentioned_person_id: string
  person: { id: string; full_name: string } | { id: string; full_name: string }[] | null
}

/**
 * Normalize the nested chat_message_mentions join into a flat ChatMention[].
 * Lives outside actions.ts because that file is `'use server'` (every export
 * there must be an async function) — this is a plain sync helper.
 */
export function normalizeMessage<T extends { mentions?: unknown }>(row: T): T & { mentions: ChatMention[] } {
  const raw = (row.mentions ?? []) as RawMentionRow[]
  const mentions: ChatMention[] = raw.map((m) => {
    const person = Array.isArray(m.person) ? m.person[0] ?? null : m.person
    return { personId: m.mentioned_person_id, fullName: person?.full_name ?? '' }
  })
  return { ...row, mentions }
}
