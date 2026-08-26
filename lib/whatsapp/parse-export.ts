// Pure parser for WhatsApp chat exports (iOS and Android, 1:1 and group).
// No IO, no Supabase. Everything that touches the wire format lives here so it
// can be exercised by scripts/whatsapp-parser-guard.ts without a database.

import { cleanDisplayName, normaliseParticipantName, stripInvisible } from './normalise'

export type DateOrder = 'DMY' | 'MDY'

export type ParsedMessage = {
  occurredAtLocal: string // 'YYYY-MM-DDTHH:mm:ss', no zone yet
  sender: string | null // null = system message with no attributable sender
  body: string
  type: 'text' | 'media' | 'system'
  mediaFilename: string | null
  deleted: boolean
}

export type ParticipantEventKind = 'created' | 'joined' | 'left'

export type ParticipantEvent = {
  occurredAtLocal: string
  kind: ParticipantEventKind
  /** Who did it (null for "joined via invite link" / unknown). 'you' resolved by the importer. */
  actor: string | null
  /** Who it happened to. 'you' means the exporting phone's owner. */
  subject: string
  /** Group title, for 'created' events. */
  title?: string
}

export type ParseResult = {
  messages: ParsedMessage[]
  /** Distinct participant display names: senders plus anyone named in join/leave events. Never includes 'you'. */
  participants: string[]
  participantEvents: ParticipantEvent[]
  /** Group title where detectable (created-group line, or the group-name pseudo-sender on system lines). */
  title: string | null
  isGroup: boolean
  /** True if the export references the phone owner as 'you' in a membership event. */
  selfReferenced: boolean
  detectedDateOrder: DateOrder | 'ambiguous'
  firstAt: string | null
  lastAt: string | null
  skippedLines: number
}

// iOS:     [11/08/2026, 14:32:05] Rob Harvey: text        (seconds optional, 12h optional)
// Android: 11/08/2026, 14:32 - Rob Harvey: text
const IOS_RE = /^\[(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\]\s?(.*)$/i
const ANDROID_RE = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s+-\s(.*)$/i

type RawLine = { a: number; b: number; year: number; hour: number; minute: number; second: number; rest: string }

function matchLine(line: string): RawLine | null {
  const m = IOS_RE.exec(line) ?? ANDROID_RE.exec(line)
  if (!m) return null
  let hour = Number(m[4])
  const ampm = m[7]?.toLowerCase().replace(/\./g, '')
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  let year = Number(m[3])
  if (year < 100) year += 2000
  return { a: Number(m[1]), b: Number(m[2]), year, hour, minute: Number(m[5]), second: Number(m[6] ?? '0'), rest: m[8] }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// System bodies that carry membership history. Names may be comma/and separated.
const CREATED_RE = /^(.+?) created (?:group|this group|the group) [“"'](.+)[”"']$/i
const ADDED_RE = /^(.+?) added (.+)$/i
const JOINED_LINK_RE = /^(.+?) joined (?:using|from) (?:this group's|the) invite link$/i
const LEFT_RE = /^(.+?) left$/i
const REMOVED_RE = /^(.+?) removed (.+)$/i
// Discard entirely — noise, not history.
const NOISE_RE =
  /(changed (?:this group's|the group) (?:icon|subject|description|settings)|changed the subject|changed this group's icon|end-to-end encrypted|security code (?:with .+ )?changed|changed their phone number|is a business account|This chat is with|Tap to learn more|You're now an admin|is now an admin|turned on disappearing messages|turned off disappearing messages|changed the group name|pinned a message)/i

const DELETED_RE = /^(?:This message was deleted|You deleted this message|Message deleted)\.?$/i
const ATTACHED_IOS_RE = /^<attached:\s*(.+?)>$/i
const ATTACHED_ANDROID_RE = /^(.+?)\s+\(file attached\)$/i
const OMITTED_RE = /^<Media omitted>$|^(?:image|video|audio|sticker|document|GIF|Contact card|Media)\s+omitted$/i

function splitNames(list: string): string[] {
  return list
    .split(/,\s*|\s+and\s+/i)
    .map((n) => cleanDisplayName(n))
    .filter(Boolean)
}

function isYou(name: string) {
  return /^you$/i.test(name.trim())
}

function classifyBody(body: string): Pick<ParsedMessage, 'type' | 'mediaFilename' | 'deleted'> {
  const trimmed = body.trim()
  if (DELETED_RE.test(trimmed)) return { type: 'text', mediaFilename: null, deleted: true }
  const ios = ATTACHED_IOS_RE.exec(trimmed)
  if (ios) return { type: 'media', mediaFilename: ios[1].trim(), deleted: false }
  const android = ATTACHED_ANDROID_RE.exec(trimmed)
  if (android) return { type: 'media', mediaFilename: android[1].trim(), deleted: false }
  if (OMITTED_RE.test(trimmed)) return { type: 'media', mediaFilename: null, deleted: false }
  return { type: 'text', mediaFilename: null, deleted: false }
}

type Pending = { a: number; b: number; year: number; hour: number; minute: number; second: number; sender: string | null; body: string }

/**
 * Parse a raw export. `dateOrder` is the caller's fallback, used only when the
 * file contains no date with a component above 12.
 */
export function parseWhatsAppExport(raw: string, dateOrder: DateOrder = 'DMY'): ParseResult {
  const text = stripInvisible(raw.replace(/^﻿/, '')).replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  const pending: Pending[] = []
  let skippedLines = 0

  for (const line of lines) {
    const m = matchLine(line)
    if (!m) {
      // Continuation of the previous message. Never drop it.
      const last = pending[pending.length - 1]
      if (last) last.body += `\n${line}`
      else if (line.trim()) skippedLines++
      continue
    }
    // Split on the FIRST ': ' only — bodies are full of colons.
    const idx = m.rest.indexOf(': ')
    let sender: string | null = null
    let body = m.rest
    if (idx > 0) {
      sender = m.rest.slice(0, idx)
      body = m.rest.slice(idx + 2)
    } else if (m.rest.endsWith(':')) {
      // "[ts] Name:" with an empty body (attachment-only lines on some builds)
      sender = m.rest.slice(0, -1)
      body = ''
    }
    pending.push({ a: m.a, b: m.b, year: m.year, hour: m.hour, minute: m.minute, second: m.second, sender, body })
  }

  // Date order: any first component > 12 → DMY; any second > 12 → MDY.
  let sawDmy = false
  let sawMdy = false
  for (const p of pending) {
    if (p.a > 12) sawDmy = true
    if (p.b > 12) sawMdy = true
  }
  if (sawDmy && sawMdy) throw new Error('Export mixes day-first and month-first dates; cannot resolve date order')
  const detectedDateOrder: DateOrder | 'ambiguous' = sawDmy ? 'DMY' : sawMdy ? 'MDY' : 'ambiguous'
  const order: DateOrder = detectedDateOrder === 'ambiguous' ? dateOrder : detectedDateOrder

  const toLocal = (p: Pending) => {
    const day = order === 'DMY' ? p.a : p.b
    const month = order === 'DMY' ? p.b : p.a
    return `${p.year}-${pad(month)}-${pad(day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`
  }

  // First pass: detect the group title so we can recognise the group-name pseudo-sender.
  let title: string | null = null
  for (const p of pending) {
    const c = CREATED_RE.exec(p.body.trim())
    if (c) {
      title = cleanDisplayName(c[2])
      break
    }
  }
  if (!title) {
    // iOS attributes the encryption notice to the group name in group exports.
    const notice = pending.find((p) => /end-to-end encrypted/i.test(p.body) && p.sender)
    if (notice?.sender) {
      const s = cleanDisplayName(notice.sender)
      // Only trust it if that "sender" never sends a normal text message.
      const sendsText = pending.some(
        (p) => p.sender && normaliseParticipantName(p.sender) === s.toLowerCase() && !NOISE_RE.test(p.body) && !ADDED_RE.test(p.body.trim())
      )
      if (!sendsText) title = s
    }
  }
  const titleKey = title ? title.toLowerCase() : null

  const messages: ParsedMessage[] = []
  const participantEvents: ParticipantEvent[] = []
  const participantSet = new Map<string, string>() // normalised → display
  let selfReferenced = false
  let sawGroupEvent = false

  const addParticipant = (name: string | null) => {
    if (!name) return
    if (isYou(name)) {
      selfReferenced = true
      return
    }
    const display = cleanDisplayName(name)
    if (!display) return
    const key = display.toLowerCase()
    if (key === titleKey) return
    if (!participantSet.has(key)) participantSet.set(key, display)
  }

  for (const p of pending) {
    const occurredAtLocal = toLocal(p)
    const body = p.body.replace(/\s+$/, '')
    const trimmed = body.trim()
    const senderIsGroup = p.sender !== null && titleKey !== null && normaliseParticipantName(p.sender) === titleKey
    const senderClean = p.sender && !senderIsGroup ? cleanDisplayName(p.sender) : null

    // Membership events. Only trusted when the line is system-shaped (no sender,
    // group pseudo-sender) or the named sender is one of the people in the event,
    // so a real message reading "Steve left" is not mistaken for history.
    const eventNamesInclude = (names: string[]) =>
      senderClean === null || names.some((n) => normaliseParticipantName(n) === normaliseParticipantName(senderClean))

    const created = CREATED_RE.exec(trimmed)
    if (created && eventNamesInclude([created[1]])) {
      const actor = cleanDisplayName(created[1])
      sawGroupEvent = true
      participantEvents.push({ occurredAtLocal, kind: 'created', actor: isYou(actor) ? null : actor, subject: actor, title: cleanDisplayName(created[2]) })
      addParticipant(actor)
      continue
    }
    const added = ADDED_RE.exec(trimmed)
    if (added && !/\bwas added\b/i.test(trimmed)) {
      const actor = cleanDisplayName(added[1])
      const subjects = splitNames(added[2])
      if (eventNamesInclude([actor, ...subjects])) {
        sawGroupEvent = true
        addParticipant(actor)
        for (const s of subjects) {
          participantEvents.push({ occurredAtLocal, kind: 'joined', actor: isYou(actor) ? null : actor, subject: isYou(s) ? 'you' : s })
          addParticipant(s)
        }
        continue
      }
    }
    const joined = JOINED_LINK_RE.exec(trimmed)
    if (joined && eventNamesInclude([joined[1]])) {
      const s = cleanDisplayName(joined[1])
      sawGroupEvent = true
      participantEvents.push({ occurredAtLocal, kind: 'joined', actor: null, subject: isYou(s) ? 'you' : s })
      addParticipant(s)
      continue
    }
    const removed = REMOVED_RE.exec(trimmed)
    if (removed) {
      const actor = cleanDisplayName(removed[1])
      const subjects = splitNames(removed[2])
      if (eventNamesInclude([actor, ...subjects])) {
        sawGroupEvent = true
        addParticipant(actor)
        for (const s of subjects) {
          participantEvents.push({ occurredAtLocal, kind: 'left', actor: isYou(actor) ? null : actor, subject: isYou(s) ? 'you' : s })
          addParticipant(s)
        }
        continue
      }
    }
    const left = LEFT_RE.exec(trimmed)
    if (left && eventNamesInclude([left[1]])) {
      const s = cleanDisplayName(left[1])
      sawGroupEvent = true
      participantEvents.push({ occurredAtLocal, kind: 'left', actor: null, subject: isYou(s) ? 'you' : s })
      addParticipant(s)
      continue
    }

    // Pure noise — discard entirely.
    if ((senderClean === null || senderIsGroup) && NOISE_RE.test(trimmed)) continue
    if (senderClean !== null && NOISE_RE.test(trimmed) && new RegExp(`^${escapeRe(senderClean)}\\b`, 'i').test(trimmed)) continue

    if (senderClean === null) {
      // Unattributed system line we don't recognise. Keep as system so nothing is lost.
      messages.push({ occurredAtLocal, sender: null, body, type: 'system', mediaFilename: null, deleted: false })
      continue
    }

    addParticipant(senderClean)
    messages.push({ occurredAtLocal, sender: senderClean, body, ...classifyBody(body) })
  }

  const participants = [...participantSet.values()].sort((a, b) => a.localeCompare(b))
  const realSenders = new Set(messages.filter((m) => m.sender).map((m) => normaliseParticipantName(m.sender as string)))
  const isGroup = sawGroupEvent || title !== null || realSenders.size > 2 || participants.length > 2

  const timestamps = messages.map((m) => m.occurredAtLocal).concat(participantEvents.map((e) => e.occurredAtLocal)).sort()

  return {
    messages,
    participants,
    participantEvents,
    title,
    isGroup,
    selfReferenced,
    detectedDateOrder,
    firstAt: timestamps[0] ?? null,
    lastAt: timestamps[timestamps.length - 1] ?? null,
    skippedLines,
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Cowork interim JSON (whatsapp-logs/*.json) → ParseResult. Same shape the
// importer consumes, so the backfill lands through the same mapping screen.
// ---------------------------------------------------------------------------

export type CoworkJsonExport = {
  conversation: string
  is_group?: boolean
  timezone?: string
  participants?: string[]
  messages: Array<{ occurred_at: string; sender: string; body: string; type?: 'text' | 'media' | 'system' }>
}

export function isCoworkJsonExport(value: unknown): value is CoworkJsonExport {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.conversation === 'string' && Array.isArray(v.messages)
}

/** Re-render the JSON as an iOS-style export and parse it, so both paths share one code path. */
export function parseCoworkJsonExport(json: CoworkJsonExport): ParseResult {
  const lines = json.messages.map((m) => {
    const d = m.occurred_at.replace(/Z$/, '')
    const [date, time] = d.split('T')
    const [y, mo, da] = date.split('-')
    const ts = `[${da}/${mo}/${y}, ${(time ?? '00:00:00').slice(0, 8)}]`
    return `${ts} ${m.sender}: ${m.body}`
  })
  const result = parseWhatsAppExport(lines.join('\n'), 'DMY')
  if (!result.title) result.title = cleanDisplayName(json.conversation)
  if (json.is_group) result.isGroup = true
  for (const p of json.participants ?? []) {
    const display = cleanDisplayName(p)
    if (display && !result.participants.some((x) => x.toLowerCase() === display.toLowerCase())) result.participants.push(display)
  }
  result.participants.sort((a, b) => a.localeCompare(b))
  return result
}
