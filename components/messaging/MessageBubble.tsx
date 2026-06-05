'use client'

import { useState } from 'react'
import Attachment from './Attachment'
import MentionToken from './MentionToken'
import type { ChatAttachment, ChatMention } from '@/app/(os)/messages/actions'

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Render a message body, lighting up `@{full_name}` substrings for people who
 * were explicitly mentioned (a mention row exists). Plain `@text` that nobody
 * picked from the autocomplete stays plain — mentions are an explicit act.
 */
function renderBody(body: string, mentions?: ChatMention[]) {
  const tokens = (mentions ?? [])
    .filter((m) => m.fullName)
    .map((m) => ({ text: `@${m.fullName}`, fullName: m.fullName }))
    // Longest first so "@Rob Harvey" wins over a hypothetical "@Rob".
    .sort((a, b) => b.text.length - a.text.length)
  if (tokens.length === 0) return body

  const nodes: React.ReactNode[] = []
  let buffer = ''
  let key = 0
  for (let i = 0; i < body.length; ) {
    const match = tokens.find((t) => body.startsWith(t.text, i))
    if (match) {
      if (buffer) { nodes.push(<span key={key++}>{buffer}</span>); buffer = '' }
      nodes.push(<MentionToken key={key++} fullName={match.fullName} />)
      i += match.text.length
    } else {
      buffer += body[i]
      i += 1
    }
  }
  if (buffer) nodes.push(<span key={key++}>{buffer}</span>)
  return nodes
}

export default function MessageBubble({
  id,
  body,
  mine,
  at,
  pending,
  edited,
  deleted,
  editable,
  attachments,
  mentions,
  onEdit,
  onRequestDelete,
}: {
  id: string
  body: string
  mine: boolean
  at: string
  pending?: boolean
  edited?: boolean
  deleted?: boolean
  /** Within the edit/delete window AND mine — show the ⋯ actions. */
  editable?: boolean
  attachments?: ChatAttachment[]
  mentions?: ChatMention[]
  onEdit?: (id: string, body: string, mentionPersonIds: string[]) => void
  onRequestDelete?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body)

  const bubbleBg = mine ? 'var(--accent)' : 'var(--surface-2)'
  const bubbleColor = mine ? '#fff' : 'var(--text)'

  function saveEdit() {
    const v = draft.trim()
    setEditing(false)
    if (!v || v === body) { setDraft(body); return }
    // Keep only mentions whose token text survives the edit (removal supported;
    // adding a new mention via the inline editor is not — there's no picker here).
    const survivingIds = (mentions ?? [])
      .filter((m) => m.fullName && v.includes(`@${m.fullName}`))
      .map((m) => m.personId)
    onEdit?.(id, v, survivingIds)
  }

  return (
    <div
      style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', position: 'relative' }}
      onMouseLeave={() => setMenuOpen(false)}
    >
      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {editing ? (
          <div style={{ display: 'grid', gap: 6, width: '100%' }}>
            <textarea
              autoFocus
              className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] resize-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                else if (e.key === 'Escape') { setEditing(false); setDraft(body) }
              }}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setDraft(body) }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 14,
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: deleted ? 'transparent' : bubbleBg,
              color: deleted ? 'var(--text-3)' : bubbleColor,
              border: deleted ? '1px dashed var(--border)' : 'none',
              fontStyle: deleted ? 'italic' : 'normal',
              opacity: pending ? 0.6 : 1,
              position: 'relative',
            }}
          >
            {deleted ? <span>Message deleted</span> : body ? <span>{renderBody(body, mentions)}</span> : null}
            <span style={{ display: 'block', fontSize: 10, opacity: 0.7, marginTop: 2, textAlign: 'right' }}>
              {edited && !deleted ? '(edited) ' : ''}{pending ? 'sending…' : fmtTime(at)}
            </span>

            {editable && !deleted ? (
              <button
                type="button"
                aria-label="Message actions"
                onClick={() => setMenuOpen((o) => !o)}
                style={{
                  position: 'absolute', top: 2, [mine ? 'left' : 'right']: -22,
                  border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1, padding: 2,
                } as React.CSSProperties}
              >
                ⋯
              </button>
            ) : null}

            {menuOpen ? (
              <div
                style={{
                  position: 'absolute', top: 22, [mine ? 'left' : 'right']: -8, zIndex: 20,
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, minWidth: 110, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                } as React.CSSProperties}
              >
                <button className="block w-full rounded-[6px] px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]" onClick={() => { setMenuOpen(false); setDraft(body); setEditing(true) }}>Edit</button>
                <button className="block w-full rounded-[6px] px-3 py-1.5 text-left text-sm text-[var(--red-strong)] hover:bg-[var(--surface-2)]" onClick={() => { setMenuOpen(false); onRequestDelete?.(id) }}>Delete</button>
              </div>
            ) : null}
          </div>
        )}
        {!deleted && attachments && attachments.length ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
            {attachments.map((a) => <Attachment key={a.id} attachment={a} />)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
