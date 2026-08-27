// Persistence side of the export importer. Works against whichever Supabase
// client the caller hands over (session client under RLS from the route).

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import type { ParseResult, ParsedMessage } from './parse-export'
import { cleanDisplayName, normaliseParticipantName } from './normalise'
import { localToUtcIso } from './time'
import { importMessageId } from './ids'
import type { WhatsAppMessageSource, WhatsAppParticipant } from '@/lib/types'

export type Numbering = 'business' | 'personal'

export interface ParticipantPlan {
  display_name: string
  contact_id: string | null
  is_self: boolean
  /** Existing participant this name is a rename of. Merge instead of creating. */
  merge_into_participant_id?: string | null
}

export interface ImportPlan {
  /** Existing conversation to import into, or null to create one. */
  conversation_id: string | null
  title: string
  is_group: boolean
  account_id: string | null
  engagement_id: string | null
  participants: ParticipantPlan[]
}

export interface ImportOptions {
  parsed: ParseResult
  plan: ImportPlan
  timezone: string
  numbering: Numbering
}

export interface ImportResult {
  conversation_id: string
  imported: number
  skipped: number
  /** Existing rows whose text was replaced by an edited version from the export. */
  edited: number
  superseded: number
  batch_id: string
}

export interface ConversationCandidate {
  id: string
  title: string
  is_group: boolean
  account: { id: string; name: string } | null
  engagement: { id: string; name: string; code: string | null } | null
  participants: Array<{ id: string; display_name: string; normalised_name: string; contact_id: string | null; is_self: boolean }>
  /** Names in the export that are not already participants in this conversation. */
  unknown_names: string[]
  /** How many export names match existing participants. */
  overlap: number
  title_match: boolean
  message_count: number
}

export interface PreviewParticipant {
  display_name: string
  normalised_name: string
  message_count: number
  joined_at: string | null
  left_at: string | null
  suggested_contact: { id: string; name: string; account_id: string | null } | null
}

export interface ImportPreview {
  title: string | null
  is_group: boolean
  count: number
  first_at: string | null
  last_at: string | null
  detected_date_order: ParseResult['detectedDateOrder']
  skipped_lines: number
  self_referenced: boolean
  participants: PreviewParticipant[]
  candidates: ConversationCandidate[]
  sample: Array<{ occurred_at_local: string; sender: string | null; body: string; type: ParsedMessage['type'] }>
}

type RawConversation = {
  id: string
  title: string
  is_group: boolean
  account: { id: string; name: string } | null
  engagement: { id: string; name: string; code: string | null } | null
  whatsapp_participants: Array<{ id: string; display_name: string; normalised_name: string; contact_id: string | null; is_self: boolean }>
}

/**
 * Everything the mapping screen needs. Matches existing conversations on title
 * first, then on participant-set overlap, and never merges anything itself.
 */
export async function previewImport(parsed: ParseResult, supabase: SupabaseClient, timezone: string): Promise<ImportPreview> {
  const names = parsed.participants
  const keys = names.map(normaliseParticipantName)

  // Candidate conversations: title match OR any participant name overlap.
  const { data: convRows, error: convErr } = await supabase
    .from('whatsapp_conversations')
    .select('id, title, is_group, account:accounts(id,name), engagement:engagements(id,name,code), whatsapp_participants(id, display_name, normalised_name, contact_id, is_self)')
  if (convErr) throw new Error(convErr.message || 'Failed to load conversations')

  const titleKey = parsed.title ? parsed.title.toLowerCase() : null
  const candidates: ConversationCandidate[] = []
  const candidateIds: string[] = []
  for (const row of (convRows ?? []) as unknown as RawConversation[]) {
    const existing = new Set(row.whatsapp_participants.map((p) => p.normalised_name))
    const overlap = keys.filter((k) => existing.has(k)).length
    const titleMatch = titleKey !== null && row.title.toLowerCase() === titleKey
    if (!titleMatch && overlap === 0) continue
    // A 1:1 export overlapping a group on one name is not a match worth showing.
    if (!titleMatch && !row.is_group && keys.length <= 2 && overlap < keys.length) continue
    candidateIds.push(row.id)
    candidates.push({
      id: row.id,
      title: row.title,
      is_group: row.is_group,
      account: row.account,
      engagement: row.engagement,
      participants: row.whatsapp_participants,
      unknown_names: names.filter((n) => !existing.has(normaliseParticipantName(n))),
      overlap,
      title_match: titleMatch,
      message_count: 0,
    })
  }
  candidates.sort((a, b) => Number(b.title_match) - Number(a.title_match) || b.overlap - a.overlap)

  if (candidateIds.length) {
    await Promise.all(
      candidates.map(async (c) => {
        const { count } = await supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id)
        c.message_count = count ?? 0
      })
    )
  }

  // Suggest contacts by exact normalised name match. Never auto-create.
  const suggestions = new Map<string, { id: string; name: string; account_id: string | null }>()
  if (names.length) {
    const { data: contacts } = await supabase.from('contacts').select('id, name, account_id').in('name', names)
    for (const c of contacts ?? []) {
      const k = normaliseParticipantName(c.name as string)
      if (!suggestions.has(k)) suggestions.set(k, { id: c.id as string, name: c.name as string, account_id: (c.account_id as string | null) ?? null })
    }
    if (suggestions.size < names.length) {
      // Case-insensitive fallback for the ones an exact match missed.
      const missing = names.filter((n) => !suggestions.has(normaliseParticipantName(n)))
      for (const n of missing) {
        const { data } = await supabase.from('contacts').select('id, name, account_id').ilike('name', n).limit(2)
        if (data && data.length === 1) suggestions.set(normaliseParticipantName(n), { id: data[0].id as string, name: data[0].name as string, account_id: (data[0].account_id as string | null) ?? null })
      }
    }
  }

  const counts = new Map<string, number>()
  for (const m of parsed.messages) if (m.sender) counts.set(normaliseParticipantName(m.sender), (counts.get(normaliseParticipantName(m.sender)) ?? 0) + 1)
  const joined = new Map<string, string>()
  const left = new Map<string, string>()
  for (const e of parsed.participantEvents) {
    const k = normaliseParticipantName(e.subject)
    if ((e.kind === 'joined' || e.kind === 'created') && !joined.has(k)) joined.set(k, e.occurredAtLocal)
    if (e.kind === 'left') left.set(k, e.occurredAtLocal)
  }

  const toUtc = (local: string | null | undefined) => (local ? localToUtcIso(local, timezone) : null)

  return {
    title: parsed.title,
    is_group: parsed.isGroup,
    count: parsed.messages.length,
    first_at: toUtc(parsed.firstAt),
    last_at: toUtc(parsed.lastAt),
    detected_date_order: parsed.detectedDateOrder,
    skipped_lines: parsed.skippedLines,
    self_referenced: parsed.selfReferenced,
    participants: names.map((n) => {
      const k = normaliseParticipantName(n)
      return {
        display_name: n,
        normalised_name: k,
        message_count: counts.get(k) ?? 0,
        joined_at: toUtc(joined.get(k)),
        left_at: toUtc(left.get(k)),
        suggested_contact: suggestions.get(k) ?? null,
      }
    }),
    candidates,
    sample: parsed.messages.slice(0, 20).map((m) => ({ occurred_at_local: m.occurredAtLocal, sender: m.sender, body: m.body, type: m.type })),
  }
}

/**
 * Commit an import. The phone export is ground truth for the window it covers:
 * live-captured rows (including drafts) inside [first, last] are deleted first
 * and reported as `superseded`.
 */
export async function commitImport(opts: ImportOptions, supabase: SupabaseClient): Promise<ImportResult> {
  const { parsed, plan, timezone, numbering } = opts
  const selfCount = plan.participants.filter((p) => p.is_self).length
  if (selfCount !== 1) throw new Error('Exactly one participant must be marked as you')

  const source: WhatsAppMessageSource = numbering === 'personal' ? 'personal_export' : 'manual_import'
  const isPersonal = numbering === 'personal'
  const batchId = randomUUID()

  // 1. Conversation.
  let conversationId = plan.conversation_id
  if (conversationId) {
    const { data: existing, error } = await supabase.from('whatsapp_conversations').select('id, account_id, engagement_id').eq('id', conversationId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!existing) throw new Error('Conversation not found')
    const patch: Record<string, unknown> = {}
    if (plan.account_id && plan.account_id !== existing.account_id) patch.account_id = plan.account_id
    if (plan.engagement_id && plan.engagement_id !== existing.engagement_id) patch.engagement_id = plan.engagement_id
    if (Object.keys(patch).length) {
      const { error: upErr } = await supabase.from('whatsapp_conversations').update(patch).eq('id', conversationId)
      if (upErr) throw new Error(upErr.message)
    }
  } else {
    const { data: created, error } = await supabase
      .from('whatsapp_conversations')
      .insert({
        title: cleanDisplayName(plan.title) || parsed.title || 'WhatsApp chat',
        is_group: plan.is_group,
        account_id: plan.account_id,
        engagement_id: plan.engagement_id,
        is_personal: isPersonal,
        client_visible: false,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    conversationId = created.id as string
  }
  const convId = conversationId

  const { data: convRow } = await supabase.from('whatsapp_conversations').select('account_id, engagement_id').eq('id', convId).single()
  const accountId = (convRow?.account_id as string | null) ?? null
  const engagementId = (convRow?.engagement_id as string | null) ?? null

  // 2. Participants: merge renames, upsert the rest by normalised name.
  const { data: existingParts, error: partErr } = await supabase.from('whatsapp_participants').select('*').eq('conversation_id', convId)
  if (partErr) throw new Error(partErr.message)
  const byKey = new Map<string, WhatsAppParticipant>()
  for (const p of (existingParts ?? []) as WhatsAppParticipant[]) byKey.set(p.normalised_name, p)

  const joined = new Map<string, string>()
  const left = new Map<string, string>()
  for (const e of parsed.participantEvents) {
    const k = e.subject === 'you' ? '__self__' : normaliseParticipantName(e.subject)
    if ((e.kind === 'joined' || e.kind === 'created') && !joined.has(k)) joined.set(k, localToUtcIso(e.occurredAtLocal, timezone))
    if (e.kind === 'left') left.set(k, localToUtcIso(e.occurredAtLocal, timezone))
  }

  for (const pp of plan.participants) {
    const display = cleanDisplayName(pp.display_name)
    const key = display.toLowerCase()
    if (!display) continue
    const joinedAt = joined.get(key) ?? (pp.is_self ? joined.get('__self__') : undefined) ?? null
    const leftAt = left.get(key) ?? (pp.is_self ? left.get('__self__') : undefined) ?? null

    if (pp.merge_into_participant_id) {
      const target = (existingParts ?? []).find((p) => p.id === pp.merge_into_participant_id) as WhatsAppParticipant | undefined
      if (!target) throw new Error(`Merge target not found for ${display}`)
      const { error } = await supabase
        .from('whatsapp_participants')
        .update({
          display_name: display,
          normalised_name: key,
          contact_id: pp.contact_id ?? target.contact_id,
          is_self: pp.is_self,
          joined_at: target.joined_at ?? joinedAt,
          left_at: leftAt ?? target.left_at,
        })
        .eq('id', target.id)
      if (error) throw new Error(error.message)
      byKey.delete(target.normalised_name)
      byKey.set(key, { ...target, display_name: display, normalised_name: key, contact_id: pp.contact_id ?? target.contact_id, is_self: pp.is_self })
      continue
    }

    const existing = byKey.get(key)
    if (existing) {
      const patch: Record<string, unknown> = {}
      if (pp.contact_id && pp.contact_id !== existing.contact_id) patch.contact_id = pp.contact_id
      if (pp.is_self !== existing.is_self) patch.is_self = pp.is_self
      if (!existing.joined_at && joinedAt) patch.joined_at = joinedAt
      if (leftAt && leftAt !== existing.left_at) patch.left_at = leftAt
      if (existing.display_name !== display) patch.display_name = display
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('whatsapp_participants').update(patch).eq('id', existing.id)
        if (error) throw new Error(error.message)
        byKey.set(key, { ...existing, ...(patch as Partial<WhatsAppParticipant>) })
      }
      continue
    }

    const { data: created, error } = await supabase
      .from('whatsapp_participants')
      .insert({ conversation_id: convId, display_name: display, normalised_name: key, contact_id: pp.contact_id, is_self: pp.is_self, joined_at: joinedAt, left_at: leftAt })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    byKey.set(key, created as WhatsAppParticipant)
  }

  // Senders that appear in the file but were not in the plan: refuse rather than guess.
  for (const m of parsed.messages) {
    if (m.sender && !byKey.has(normaliseParticipantName(m.sender))) throw new Error(`Participant "${m.sender}" is not mapped. Re-run the preview.`)
  }

  // 3. Build rows with stable IDs.
  const seen = new Map<string, number>()
  const rows = parsed.messages.map((m) => {
    const occurredAt = localToUtcIso(m.occurredAtLocal, timezone)
    let id = importMessageId(convId, occurredAt, m.sender, m.body)
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    if (n > 1) id = `${id}#${n}`
    const participant = m.sender ? byKey.get(normaliseParticipantName(m.sender)) ?? null : null
    return {
      wa_message_id: id,
      conversation_id: convId,
      sender_participant_id: participant?.id ?? null,
      direction: participant?.is_self ? 'outbound' : 'inbound',
      display_name: m.sender,
      contact_id: participant?.contact_id ?? null,
      account_id: accountId,
      engagement_id: engagementId,
      type: m.type,
      body: m.deleted ? null : m.body,
      media_filename: m.mediaFilename,
      source,
      is_personal: isPersonal,
      client_visible: false,
      is_draft: false,
      occurred_at: occurredAt,
      occurred_at_precision: 'exact',
      revoked_at: m.deleted ? occurredAt : null,
      edited_at: m.edited ? occurredAt : null,
      import_batch_id: batchId,
    }
  })

  if (rows.length === 0) return { conversation_id: convId, imported: 0, skipped: 0, edited: 0, superseded: 0, batch_id: batchId }

  const first = rows.reduce((a, r) => (r.occurred_at < a ? r.occurred_at : a), rows[0].occurred_at)
  const last = rows.reduce((a, r) => (r.occurred_at > a ? r.occurred_at : a), rows[0].occurred_at)

  // 4. Supersede live-captured rows inside the window (drafts included).
  const { data: captured, error: capErr } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('conversation_id', convId)
    .eq('source', 'cowork_capture')
    .gte('occurred_at', first)
    .lte('occurred_at', last)
  if (capErr) throw new Error(capErr.message)
  let superseded = 0
  if (captured && captured.length) {
    const { error: delErr } = await supabase.from('whatsapp_messages').delete().in('id', captured.map((c) => c.id as string))
    if (delErr) throw new Error(delErr.message)
    superseded = captured.length
  }

  // 5. Skip what is already there, insert the rest in chunks.
  const { data: existingIds, error: exErr } = await supabase.from('whatsapp_messages').select('wa_message_id').eq('conversation_id', convId)
  if (exErr) throw new Error(exErr.message)
  const have = new Set((existingIds ?? []).map((r) => r.wa_message_id as string))
  const fresh = rows.filter((r) => !have.has(r.wa_message_id))

  // 5b. Reconcile edits. An edited message hashes differently (the body changed),
  // so it arrives here looking new. If exactly one existing row shares its
  // timestamp and sender, and nothing else in this batch claims that row, it is
  // an edit: update in place and re-key it. Any ambiguity → insert; a duplicate
  // is recoverable, overwriting the wrong record is not.
  let edited = 0
  const toInsert: typeof fresh = []
  if (fresh.length) {
    const keyOf = (r: { occurred_at: string; sender_participant_id: string | null }) => `${r.occurred_at}|${r.sender_participant_id ?? ''}`
    const incomingByKey = new Map<string, number>()
    for (const r of fresh) incomingByKey.set(keyOf(r), (incomingByKey.get(keyOf(r)) ?? 0) + 1)
    const existingByKey = new Map<string, Array<{ id: string; occurred_at: string; sender_participant_id: string | null }>>()
    const times = [...new Set(fresh.map((r) => r.occurred_at))]
    for (let i = 0; i < times.length; i += 200) {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, occurred_at, sender_participant_id')
        .eq('conversation_id', convId)
        .in('occurred_at', times.slice(i, i + 200))
      if (error) throw new Error(error.message)
      for (const ex of (data ?? []) as Array<{ id: string; occurred_at: string; sender_participant_id: string | null }>) {
        const k = keyOf({ occurred_at: new Date(ex.occurred_at).toISOString(), sender_participant_id: ex.sender_participant_id })
        existingByKey.set(k, [...(existingByKey.get(k) ?? []), ex])
      }
    }
    const now = new Date().toISOString()
    for (const r of fresh) {
      const k = keyOf(r)
      const matches = existingByKey.get(k) ?? []
      if (r.sender_participant_id && matches.length === 1 && incomingByKey.get(k) === 1) {
        const { error } = await supabase
          .from('whatsapp_messages')
          .update({ body: r.body, type: r.type, media_filename: r.media_filename, revoked_at: r.revoked_at, edited_at: now, wa_message_id: r.wa_message_id })
          .eq('id', matches[0].id)
        if (error) throw new Error(error.message)
        edited++
      } else {
        toInsert.push(r)
      }
    }
  }

  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await supabase.from('whatsapp_messages').insert(toInsert.slice(i, i + 500))
    if (error) throw new Error(error.message)
  }

  const { error: lmErr } = await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: last })
    .eq('id', convId)
    .or(`last_message_at.is.null,last_message_at.lt.${last}`)
  if (lmErr) throw new Error(lmErr.message)

  return { conversation_id: convId, imported: toInsert.length, skipped: rows.length - fresh.length, edited, superseded, batch_id: batchId }
}

/** Undo one import batch. Returns the number of rows removed. */
export async function deleteImportBatch(batchId: string, supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.from('whatsapp_messages').delete().eq('import_batch_id', batchId).select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

/**
 * Merge one participant into another (rename detected after the fact): rows are
 * reassigned, the newest display name is kept, the duplicate is removed.
 */
export async function mergeParticipants(fromId: string, intoId: string, supabase: SupabaseClient): Promise<WhatsAppParticipant> {
  if (fromId === intoId) throw new Error('Cannot merge a participant into itself')
  const { data: pair, error } = await supabase.from('whatsapp_participants').select('*').in('id', [fromId, intoId])
  if (error) throw new Error(error.message)
  const from = (pair ?? []).find((p) => p.id === fromId) as WhatsAppParticipant | undefined
  const into = (pair ?? []).find((p) => p.id === intoId) as WhatsAppParticipant | undefined
  if (!from || !into) throw new Error('Participant not found')
  if (from.conversation_id !== into.conversation_id) throw new Error('Participants belong to different conversations')

  const { error: reErr } = await supabase.from('whatsapp_messages').update({ sender_participant_id: intoId, contact_id: into.contact_id ?? from.contact_id }).eq('sender_participant_id', fromId)
  if (reErr) throw new Error(reErr.message)

  const newest = (from.created_at > into.created_at ? from : into)
  const patch = {
    display_name: newest.display_name,
    normalised_name: newest.normalised_name,
    contact_id: into.contact_id ?? from.contact_id,
    is_self: into.is_self || from.is_self,
    joined_at: [into.joined_at, from.joined_at].filter(Boolean).sort()[0] ?? null,
    left_at: into.left_at ?? from.left_at,
  }
  const { error: delErr } = await supabase.from('whatsapp_participants').delete().eq('id', fromId)
  if (delErr) throw new Error(delErr.message)
  const { data: updated, error: upErr } = await supabase.from('whatsapp_participants').update(patch).eq('id', intoId).select('*').single()
  if (upErr) throw new Error(upErr.message)
  return updated as WhatsAppParticipant
}
