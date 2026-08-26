'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import EntityCombobox from './EntityCombobox'
import WhatsAppImportModal from './WhatsAppImportModal'
import { apiFetch } from '@/lib/api-fetch'
import type { WhatsAppConversationWithMessages, WhatsAppMessage, WhatsAppParticipantWithContact } from '@/lib/types'

// Conversation-scoped WhatsApp timeline for contact, account and engagement
// detail pages. Group chats get sender attribution on every bubble, the way
// WhatsApp does it: a stable colour per participant, name above the bubble,
// your own messages right-aligned and accented.

const COLLAPSED_LIMIT = 50

// Stable per-participant colours (text / dim background).
const PALETTE = [
  ['#0f766e', 'rgba(15,118,110,0.10)'],
  ['#b45309', 'rgba(180,83,9,0.10)'],
  ['#6d28d9', 'rgba(109,40,217,0.10)'],
  ['#be123c', 'rgba(190,18,60,0.10)'],
  ['#1d4ed8', 'rgba(29,78,216,0.10)'],
  ['#4d7c0f', 'rgba(77,124,15,0.10)'],
  ['#9d174d', 'rgba(157,23,77,0.10)'],
  ['#0e7490', 'rgba(14,116,144,0.10)'],
]
function colourFor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const [fg, bg] = PALETTE[h % PALETTE.length]
  return [fg, bg]
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(m: WhatsAppMessage) {
  const d = new Date(m.occurred_at)
  if (m.occurred_at_precision === 'day') return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  // Never render an approximate timestamp as though it were exact.
  return m.occurred_at_precision === 'minute' ? `~${t}` : t
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Props = {
  conversations: WhatsAppConversationWithMessages[]
  contactId?: string | null
  accountId?: string | null
  engagementId?: string | null
  title?: string
  description?: string
}

export default function WhatsAppTimeline({ conversations, contactId, accountId, engagementId, title = 'WhatsApp', description = 'Chat exports and live-captured exchanges. Nothing here is client-visible.' }: Props) {
  const router = useRouter()
  const [importOpen, setImportOpen] = useState(false)

  return (
    <div className="os-card rounded-[2rem] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--text)]">{title}</h2>
          <p className="text-sm text-[color:var(--text-2)]">{description}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setImportOpen(true)}>
          Import chat export
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-dashed border-[var(--border)] px-4 py-8 text-sm text-[color:var(--text-2)]">
          No WhatsApp conversations yet. Export a chat from the phone (without media) and import it here, or let Cowork capture exchanges live.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {conversations.map((c) => (
            <ConversationPanel key={c.id} conversation={c} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}

      {importOpen ? (
        <WhatsAppImportModal
          defaultAccountId={accountId ?? null}
          defaultEngagementId={engagementId ?? null}
          defaultContactId={contactId ?? null}
          onClose={() => setImportOpen(false)}
          onImported={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}

function ConversationPanel({ conversation, onChanged }: { conversation: WhatsAppConversationWithMessages; onChanged: () => void }) {
  const [showAll, setShowAll] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [participants, setParticipants] = useState(conversation.participants)
  const [messages, setMessages] = useState(conversation.messages)
  const [error, setError] = useState('')
  const [linking, setLinking] = useState<string | null>(null)

  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants])
  const visible = useMemo(() => {
    // Stored newest-first; render oldest-first, most recent N.
    const slice = showAll ? messages : messages.slice(0, COLLAPSED_LIMIT)
    return [...slice].reverse()
  }, [messages, showAll])

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: WhatsAppMessage[] }> = []
    for (const m of visible) {
      const day = dayKey(m.occurred_at)
      const last = out[out.length - 1]
      if (last && last.day === day) last.items.push(m)
      else out.push({ day, items: [m] })
    }
    return out
  }, [visible])

  async function linkParticipant(participantId: string, contactId: string | null) {
    setError('')
    try {
      const { participant } = await apiFetch<{ participant: WhatsAppParticipantWithContact }>(`/api/whatsapp/participants/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      })
      setParticipants((cur) => cur.map((p) => (p.id === participantId ? { ...p, ...participant } : p)))
      setLinking(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link contact')
    }
  }

  async function confirmSent(messageId: string) {
    setError('')
    try {
      await apiFetch(`/api/whatsapp/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_draft: false }),
      })
      setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, is_draft: false } : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm')
    }
  }

  async function discardDraft(messageId: string) {
    setError('')
    try {
      await apiFetch(`/api/whatsapp/messages/${messageId}`, { method: 'DELETE' })
      setMessages((cur) => cur.filter((m) => m.id !== messageId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard draft')
    }
  }

  const hidden = messages.length - Math.min(messages.length, COLLAPSED_LIMIT)

  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[var(--card-alt)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[color:var(--text)]">{conversation.title}</p>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--text-2)]">
              {conversation.is_group ? `Group · ${participants.length}` : '1:1'}
            </span>
            {conversation.is_personal ? <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--text-2)]">Personal number</span> : null}
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[color:var(--text-2)]">{conversation.message_count} messages</span>
          </div>
          <p className="mt-1 text-xs text-[color:var(--text-2)]">
            {conversation.account ? <Link className="underline-offset-2 hover:underline" href={`/crm/accounts/${conversation.account.id}`}>{conversation.account.name}</Link> : 'No account'}
            {' · '}
            {conversation.engagement ? <Link className="underline-offset-2 hover:underline" href={`/engagements/${conversation.engagement.id}`}>{conversation.engagement.code ?? conversation.engagement.name}</Link> : 'No engagement'}
          </p>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setShowParticipants((v) => !v)}>
          {showParticipants ? 'Hide participants' : 'Participants'}
        </button>
      </div>

      {showParticipants ? (
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]">Who was in the room</p>
          <ul className="space-y-2">
            {participants.map((p) => {
              const [fg] = colourFor(p.id)
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: fg }} />
                  <span className="font-medium text-[color:var(--text)]">{p.display_name}</span>
                  {p.is_self ? <span className="text-xs text-[color:var(--text-2)]">(you)</span> : null}
                  {p.contact ? (
                    <Link href={`/crm/contacts/${p.contact.id}`} className="text-xs text-[color:var(--accent-strong)] hover:underline">
                      {p.contact.name}
                    </Link>
                  ) : (
                    <span className="text-xs text-[color:var(--text-3)]">unmapped</span>
                  )}
                  <span className="text-xs text-[color:var(--text-3)]">
                    {p.joined_at ? `joined ${fmtDate(p.joined_at)}` : ''}
                    {p.left_at ? ` · left ${fmtDate(p.left_at)}` : ''}
                  </span>
                  {!p.is_self ? (
                    <button type="button" className="text-xs text-[color:var(--accent-strong)] hover:underline" onClick={() => setLinking(linking === p.id ? null : p.id)}>
                      {p.contact ? 'change' : 'link to contact'}
                    </button>
                  ) : null}
                  {linking === p.id ? (
                    <div className="w-full max-w-sm pt-1">
                      <EntityCombobox
                        label="Contact"
                        entity="contact"
                        value={p.contact_id ?? ''}
                        selectedLabel={p.contact?.name ?? ''}
                        clearable
                        onChange={(opt) => void linkParticipant(p.id, opt.id || null)}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="px-4 py-3">
        {hidden > 0 && !showAll ? (
          <button type="button" className="mb-3 w-full rounded-2xl border border-dashed border-[var(--border)] py-2 text-xs text-[color:var(--text-2)] hover:border-[var(--accent)]" onClick={() => setShowAll(true)}>
            Show all {messages.length} messages ({hidden} earlier hidden)
          </button>
        ) : null}

        {groups.map((g) => (
          <div key={g.day} className="mb-3">
            <div className="my-2 text-center text-[11px] uppercase tracking-wide text-[color:var(--text-3)]">{g.day}</div>
            <div className="space-y-1.5">
              {g.items.map((m) => (
                <Bubble
                  key={m.id}
                  message={m}
                  participant={m.sender_participant_id ? byId.get(m.sender_participant_id) ?? null : null}
                  isGroup={conversation.is_group}
                  onLink={(pid) => {
                    setShowParticipants(true)
                    setLinking(pid)
                  }}
                  onConfirm={() => void confirmSent(m.id)}
                  onDiscard={() => void discardDraft(m.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {messages.length === 0 ? <p className="text-sm text-[color:var(--text-2)]">No messages yet.</p> : null}
        {error ? <p className="mt-2 text-xs text-[color:var(--red-strong)]">{error}</p> : null}
      </div>
    </div>
  )
}

function Bubble({
  message: m,
  participant,
  isGroup,
  onLink,
  onConfirm,
  onDiscard,
}: {
  message: WhatsAppMessage
  participant: WhatsAppParticipantWithContact | null
  isGroup: boolean
  onLink: (participantId: string) => void
  onConfirm: () => void
  onDiscard: () => void
}) {
  const self = participant?.is_self ?? m.direction === 'outbound'
  const [fg, bg] = participant ? colourFor(participant.id) : ['var(--text-2)', 'transparent']
  const name = participant?.display_name ?? m.display_name ?? 'Unknown'

  if (m.type === 'system') {
    return <p className="text-center text-[11px] italic text-[color:var(--text-3)]">{m.body}</p>
  }

  return (
    <div className={`flex ${self ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${self ? 'rounded-br-sm' : 'rounded-bl-sm'} ${m.is_draft ? 'border border-dashed opacity-75' : 'border'}`}
        style={{
          background: self ? 'var(--accent-dim, rgba(132,204,22,0.12))' : bg || 'var(--surface-2)',
          borderColor: m.is_draft ? fg : 'var(--border)',
        }}
      >
        {isGroup || !self ? (
          <div className="mb-0.5 flex items-center gap-2 text-[11px] font-semibold" style={{ color: self ? 'var(--accent-strong)' : fg }}>
            <span>{self ? 'You' : name}</span>
            {!self && participant && !participant.contact ? (
              <button type="button" className="font-normal text-[color:var(--text-3)] underline-offset-2 hover:underline" onClick={() => onLink(participant.id)}>
                link to contact
              </button>
            ) : null}
            {!self && participant?.contact ? (
              <Link href={`/crm/contacts/${participant.contact.id}`} className="font-normal text-[color:var(--text-3)] hover:underline">
                {participant.contact.name !== name ? participant.contact.name : ''}
              </Link>
            ) : null}
          </div>
        ) : null}

        {m.revoked_at ? (
          <p className="italic text-[color:var(--text-3)]">message deleted</p>
        ) : m.type === 'media' ? (
          <p className="italic text-[color:var(--text-2)]">
            {m.media_filename ? `📎 ${m.media_filename}` : `📷 ${m.body || 'media'}`}
            <span className="text-[11px] text-[color:var(--text-3)]"> — not imported</span>
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[color:var(--text)]">{m.body}</p>
        )}

        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-[color:var(--text-3)]">
          {m.is_draft ? (
            <>
              <span className="rounded-full border border-dashed px-1.5 py-px" style={{ borderColor: fg, color: fg }}>
                draft, not sent
              </span>
              <button type="button" title="Confirm this was sent" className="hover:text-[color:var(--accent-strong)]" onClick={onConfirm}>
                ✓ sent
              </button>
              <button type="button" title="Discard draft" className="hover:text-[color:var(--red-strong)]" onClick={onDiscard}>
                ✕
              </button>
            </>
          ) : null}
          {m.source === 'cowork_capture' && !m.is_draft ? <span title="Captured live by Cowork; a later export supersedes it">live</span> : null}
          <span>{fmtTime(m)}</span>
        </div>
      </div>
    </div>
  )
}
